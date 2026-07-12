import { Router } from "express";
import supabase from "../lib/supabase.js";
import verifyJWT from "../middleware/verifyJWT.js";

const router = Router();

// Helper: build full dashboard payload for ONE enrollment
async function buildEnrollmentData(enrollment) {
  // Get lectures — by batch if assigned, otherwise by course
  let lectureQuery = supabase
    .from("lectures")
    .select(
      "id, title, description, video_path, order_num, level, course, batch_id",
    )
    .order("order_num", { ascending: true });

  if (enrollment.batch_id) {
    lectureQuery = lectureQuery.eq("batch_id", enrollment.batch_id);
  } else {
    lectureQuery = lectureQuery
      .eq("course", enrollment.course)
      .is("batch_id", null);
  }

  const { data: lectures } = await lectureQuery;

  // Generate signed URLs for each lecture
  const lecturesWithUrls = await Promise.all(
    (lectures || []).map(async (lecture) => {
      const { data: signedUrl } = await supabase.storage
        .from("Lectures")
        .createSignedUrl(lecture.video_path, 7200);

      return {
        ...lecture,
        url: signedUrl?.signedUrl || null,
      };
    }),
  );

  // Group lectures by level
  const groupedLectures = {};
  lecturesWithUrls.forEach((lecture) => {
    const level = lecture.level || "General";
    if (!groupedLectures[level]) groupedLectures[level] = [];
    groupedLectures[level].push(lecture);
  });

  // Get class notes (tied to course)
 const { data: classNotes } = await supabase
  .from("study_materials")
  .select(
    "id, title, description, type, file_path, url, level, order_num, material_category, section",
  )
  .eq("material_category", "class_notes")
  .eq("course", enrollment.course)
  .order("order_num", { ascending: true });


  // Get exam materials (tied to exam_type)
  const { data: examMaterials } = await supabase
    .from("study_materials")
    .select(
      "id, title, description, type, file_path, url, level, order_num, material_category",
    )
    .eq("material_category", "exam_prep")
    .eq("exam_type", enrollment.exam_type || "TEF")
    .order("order_num", { ascending: true });
  
  // Fetch test materials (section-based)
const { data: testMaterials } = await supabase
  .from('study_materials')
  .select('*')
  .eq('material_category', 'test')
  .order('section', { ascending: true })
  .order('order_num', { ascending: true });

  

  // Generate signed URLs helper
  async function attachUrls(items) {
    return Promise.all(
      (items || []).map(async (material) => {
        if (material.file_path) {
          const { data: signedUrl } = await supabase.storage
            .from("Material")
            .createSignedUrl(material.file_path, 7200);
          return { ...material, downloadUrl: signedUrl?.signedUrl || null };
        }
        return { ...material, downloadUrl: material.url || null };
      }),
    );
  }

  const classNotesWithUrls = await attachUrls(classNotes);
  const examMaterialsWithUrls = await attachUrls(examMaterials);

  // Get Meet link and schedule for this course
  const { data: settings } = await supabase
    .from("course_settings")
    .select("meet_link, meet_schedule")
    .eq("course", enrollment.course)
    .single();

  return {
    enrollmentId:    enrollment.id,
    course:          enrollment.course,
    examType:        enrollment.exam_type || "TEF",
    enrolledAt:      enrollment.enrolled_at,
    batch:           enrollment.batches || null,
    lectures:        lecturesWithUrls,
    groupedLectures: groupedLectures,
    classNotes:      classNotesWithUrls,
    examMaterials:   examMaterialsWithUrls,
testMaterials: await attachUrls(testMaterials || []),
    meetLink:        enrollment.batches?.meet_link || settings?.meet_link || null,
    schedule:        enrollment.batches
      ? `${enrollment.batches.days} · ${enrollment.batches.timing}`
      : settings?.meet_schedule || null,
  };
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