# بنية قاعدة البيانات

كل الجداول بالبادئة `qm_`، مغلقة بـ RLS، والكتابة عبر دوال `SECURITY DEFINER` (`set search_path = ''`) تتحقق من الدور على الخادم. الدالة ممنوحة لـ `authenticated` فقط. لا تعديل على جداول النواة، وتُقرأ منها: `students`, `student_enrollments`, `academic_years`, `grade_levels`, `class_sections`, `staff_members`, `staff_roles`.

## 0201: التأسيس (التعزيز والسلوك)
`qm_staff_roles` (agent/counselor)، `qm_settings`، `qm_reinforcement_types`، `qm_badges`، `qm_behavior_categories`، `qm_incident_statuses`، `qm_reinforcements`، `qm_points_ledger` (دفتر نقاط غير قابل للتعديل، الإلغاء بحركة عكسية)، `qm_student_badges`، `qm_positive_records`، `qm_incidents`، `qm_incident_events` (مستويات ظهور: معلم/داخلي/سري)، `qm_notifications`، `qm_audit_logs`.

## 0202: الإنجاز والمواهب والدعم
`qm_achievement_categories`، `qm_achievements` (pending/verified/needs_info/rejected)، `qm_achievement_students`، `qm_talents`، `qm_support_types`، `qm_support_cases` (new/active/closed، مع `retention_until`)، `qm_support_plans`، `qm_support_events`. المعلم لا يقرأ حالات الدعم إطلاقاً.

## 0203: التقارير
`qm_report(from, to)` أعداد مجمّعة فقط.

## الدوال حسب الدور
- الجميع: `qm_give_reinforcement`, `qm_report_incident`, `qm_record_positive`, `qm_achievement_create`, `qm_talent_add`, `qm_students_search`, `qm_student_card`, `qm_dashboard`, `qm_dashboard_ext`.
- الوكيل: `qm_incident_act` (مراجعة، استكمال، إجراء، إحالة، إغلاق، حفظ).
- الموجه: إجراءات الإرشاد في `qm_incident_act`، و`qm_support_add_plan`, `qm_support_act`.
- الوكيل والموجه: `qm_support_open`, `qm_support_list`, `qm_support_get`.
- مدير النواة: `qm_achievement_verify`, `qm_void_reinforcement`, `qm_adjust_points`, `qm_set_role`, جداول الإعدادات.

## الخصوصية
لا حسابات للمتعلمين أو أولياء الأمور. المرفقات في حاوية خاصة `qm-attachments` يبدأ مسارها بمعرّف المستخدم وتُفتح بروابط موقّعة قصيرة. كل عملية حساسة تُسجَّل في `qm_audit_logs`.
- 0208: إدارة النقاط (تعديل/إضافة) وإثراء qm_student_profile بالمراتب والتحديثات
