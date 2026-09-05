import { Router } from "express";
import supabase from "../lib/supabase.js";
import verifyJWT from "../middleware/verifyJWT.js";

const router = Router();

// Helper: build full dashboard payload for ONE enrollment
async function buildEnrollmentData(enrollment) {

  // ── STEP 1: Run all DB queries in PARALLEL ──────────
  const lectureQuery = enrollment.batch_id
    ? supabase.from('lectures')
        .select('id,title,description,video_path,order_num,level,course,batch_id')
        .eq('batch_id', enrollment.batch_id)
        .order('order_num', { ascending: true })
    : supabase.from('lectures')
        .select('id,title,description,video_path,order_num,level,course,batch_id')
        .eq('course', enrollment.course)
        .is('batch_id', null)
        .order('order_num', { ascending: true })

  const [
    lectureResult,
    classNotesResult,
    examMaterialsResult,
    worksheetsResult,
    settingsResult
  ] = await Promise.all([
    lectureQuery,
    supabase.from('study_materials')
      .select('id,title,description,type,file_path,url,level,order_num,material_category,section')
      .eq('material_category', 'class_notes')
      .eq('course', enrollment.course)
      .order('order_num', { ascending: true }),
    supabase.from('study_materials')
      .select('id,title,description,type,file_path,url,level,order_num,material_category')
      .eq('material_category', 'exam_prep')
      .eq('exam_type', enrollment.exam_type || 'TEF')
      .order('order_num', { ascending: true }),
    supabase.from('study_materials')
      .select('id,title,description,type,file_path,url,level,order_num,material_category,section')
      .eq('material_category', 'worksheet')
      .eq('course', enrollment.course)
      .order('order_num', { ascending: true }),
    supabase.from('course_settings')
      .select('meet_link,meet_schedule')
      .eq('course', enrollment.course)
      .single()
  ])

  const lectures      = lectureResult.data      || []
  const classNotes    = classNotesResult.data    || []
  const examMaterials = examMaterialsResult.data || []
  const worksheets    = worksheetsResult.data    || []
  const settings      = settingsResult.data

  // ── STEP 2: Batch signed URL generation ─────────────
  async function attachUrls(items, bucket) {
    const pathField = bucket === 'Lectures' ? 'video_path' : 'file_path'
    const urlField  = bucket === 'Lectures' ? 'url' : 'downloadUrl'

    const withPaths = items.filter(item => item[pathField])
    if (withPaths.length === 0) {
      return items.map(item => ({ ...item, [urlField]: item.url || null }))
    }

    // ONE batch API call instead of one per file
    const { data: signedUrls } = await supabase.storage
      .from(bucket)
      .createSignedUrls(withPaths.map(item => item[pathField]), 7200)

    const urlMap = {}
    ;(signedUrls || []).forEach(({ path, signedUrl }) => {
      urlMap[path] = signedUrl
    })

    return items.map(item => ({
      ...item,
      [urlField]: item[pathField]
        ? (urlMap[item[pathField]] || null)
        : (item.url || null)
    }))
  }

  // ── STEP 3: Generate all signed URLs in PARALLEL ────
  const [
    lecturesWithUrls,
    classNotesWithUrls,
    examMaterialsWithUrls,
    worksheetsWithUrls
  ] = await Promise.all([
    attachUrls(lectures,      'Lectures'),
    attachUrls(classNotes,    'Material'),
    attachUrls(examMaterials, 'Material'),
    attachUrls(worksheets,    'Material')
  ])

  // ── STEP 4: Group lectures by level ─────────────────
  const groupedLectures = {}
  lecturesWithUrls.forEach(lecture => {
    const level = lecture.level || 'General'
    if (!groupedLectures[level]) groupedLectures[level] = []
    groupedLectures[level].push(lecture)
  })

  // ── STEP 5: Return full enrollment data ─────────────
  return {
    enrollmentId:    enrollment.id,
    course:          enrollment.course,
    examType:        enrollment.exam_type || 'TEF',
    enrolledAt:      enrollment.enrolled_at,
    batch:           enrollment.batches || null,
    lectures:        lecturesWithUrls,
    groupedLectures: groupedLectures,
    classNotes:      classNotesWithUrls,
    examMaterials:   examMaterialsWithUrls,
    worksheets:      worksheetsWithUrls,
    meetLink:        enrollment.batches?.meet_link || settings?.meet_link || null,
    schedule:        enrollment.batches
      ? `${enrollment.batches.days} · ${enrollment.batches.timing}`
      : settings?.meet_schedule || null,
  }
}

// GET student dashboard — returns ALL active enrollments
router.get("/dashboard", verifyJWT, async (req, res) => {
  const studentId = req.user.sub;

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select(
      `
      id,
      course,
      status,
      enrolled_at,
      batch_id,
      exam_type,
      batches (
        batch_name,
        days,
        timing,
        meet_link
      )
    `,
    )
    .eq("student_id", studentId)
    .eq("status", "active")
    .order("enrolled_at", { ascending: false });

  if (!enrollments || enrollments.length === 0) {
    return res.status(200).json({
      enrolled: false,
      enrollments: [],
    });
  }

  const enrollmentData = await Promise.all(
    enrollments.map((e) => buildEnrollmentData(e)),
  );

  return res.status(200).json({
    enrolled: true,
    enrollments: enrollmentData,
  });
});

// GET single lecture with signed URL
router.get("/lecture/:id", verifyJWT, async (req, res) => {
  const { id } = req.params;
  const studentId = req.user.sub;

  // Get lecture first
  const { data: lecture, error } = await supabase
    .from("lectures")
    .select(
      "id, title, description, video_path, order_num, level, course, batch_id",
    )
    .eq("id", id)
    .single();

  if (error || !lecture) {
    return res.status(404).json({ error: "Lecture not found" });
  }

  // Check ALL active enrollments for this student — does ANY of them grant access?
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("course, batch_id")
    .eq("student_id", studentId)
    .eq("status", "active");

  const hasAccess = (enrollments || []).some((enrollment) => {
    return (
      (lecture.batch_id && lecture.batch_id === enrollment.batch_id) ||
      (!lecture.batch_id && lecture.course === enrollment.course)
    );
  });

  if (!hasAccess) {
    return res.status(403).json({ error: "Access denied" });
  }

  // Generate signed URL
  const { data: signedUrl } = await supabase.storage
    .from("Lectures")
    .createSignedUrl(lecture.video_path, 7200);

  return res.status(200).json({
    lecture: {
      ...lecture,
      url: signedUrl?.signedUrl || null,
    },
  });
});

export default router;