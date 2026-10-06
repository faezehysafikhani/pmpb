# ساختار پیشنهادی پایگاه داده (Database Schema)

این سند، ساختار پیشنهادی برای پایگاه داده رابطه‌ای (مانند PostgreSQL یا MySQL) را بر اساس مدل‌های داده تعریف شده در فایل `types.ts` اپلیکیشن تشریح می‌کند.

---

### جدول: `Users`

این جدول اطلاعات حساب‌های کاربری را ذخیره می‌کند.

| ستون (Column) | نوع (Type)                                       | محدودیت‌ها (Constraints)              | توضیحات (Notes)                                   |
|---------------|----------------------------------------------------|-----------------------------------------|---------------------------------------------------|
| `id`          | `INTEGER` / `SERIAL`                               | Primary Key, Not Null                   | شناسه منحصر به فرد کاربر (خودکار افزایش‌یابنده)    |
| `username`    | `VARCHAR(255)`                                     | Unique, Not Null                        | نام کاربری برای ورود                              |
| `password`    | `VARCHAR(255)`                                     | Not Null                                | به صورت هش شده ذخیره می‌شود (مثلاً با bcrypt)      |
| `role`        | `ENUM('Admin', 'Project Manager', 'Project Team')` | Not Null                                | نقش و سطح دسترسی کاربر را مشخص می‌کند          |
| `is_active`   | `BOOLEAN`                                          | Not Null, Default `TRUE`                | وضعیت فعال یا غیرفعال بودن کاربر را نشان می‌دهد |

---

### جدول: `Projects`

جدول اصلی برای ذخیره اطلاعات پروژه‌ها.

| ستون (Column)         | نوع (Type)                                               | محدودیت‌ها (Constraints)          | توضیحات (Notes)                                   |
|-------------------------|-----------------------------------------------------------|-------------------------------------|---------------------------------------------------|
| `id`                    | `INTEGER` / `SERIAL`                                      | Primary Key, Not Null               | شناسه منحصر به فرد پروژه                           |
| `name`                  | `VARCHAR(255)`                                            | Not Null                            | نام پروژه                                         |
| `type`                  | `ENUM('waterfall', 'agile')`                              | Not Null                            | نوع پروژه (آبشاری یا چابک)                       |
| `description`           | `TEXT`                                                    |                                     | شرح کلی پروژه                                    |
| `goal`                  | `TEXT`                                                    |                                     | اهداف اصلی پروژه                                 |
| `requirements`          | `TEXT`                                                    |                                     | الزامات و نیازمندی‌های پروژه                       |
| `project_manager_id`    | `INTEGER`                                                 | Foreign Key -> `Users.id`           | شناسه مدیر پروژه                                  |
| `calendar_id`           | `INTEGER`                                                 | Foreign Key -> `Calendars.id`       | شناسه تقویم کاری پروژه                           |
| `owning_unit`           | `VARCHAR(255)`                                            | Not Null                            | واحد سازمانی مالک پروژه                           |
| `start_date`            | `DATE`                                                    | Not Null                            | تاریخ شروع پروژه                                  |
| `end_date`              | `DATE`                                                    | Not Null                            | تاریخ پایان پروژه                                 |
| `status`                | `ENUM('Planning', 'In Progress', 'On Hold', 'Completed')` | Not Null                            | وضعیت فعلی انجام پروژه                            |
| `approval_status`       | `ENUM('Draft', 'Pending Approval', 'Approved', ...)`      | Not Null, Default `'Draft'`         | وضعیت تأیید پروژه                                 |
| `approval_comment`      | `TEXT`                                                    |                                     | توضیحات مربوط به فرآیند تأیید                      |
| `submission_date`       | `DATE`                                                    |                                     | تاریخ ارسال برای تأیید                             |

---

### جدول: `Calendars`

برای تعریف تقویم‌های کاری مختلف.

| ستون (Column)     | نوع (Type)         | محدودیت‌ها (Constraints)    | توضیحات (Notes)                                     |
|-----------------|---------------------|-------------------------------|------------------------------------------------------|
| `id`            | `INTEGER` / `SERIAL`  | Primary Key, Not Null         | شناسه منحصر به فرد تقویم                             |
| `name`          | `VARCHAR(255)`      | Not Null                      | نام تقویم (مثلاً "تقویم رسمی" یا "تقویم شیفتی")       |
| `is_default`    | `BOOLEAN`           | Default `FALSE`               | مشخص می‌کند که آیا این تقویم پیش‌فرض است یا خیر     |
| `working_days`  | `JSON` or `VARCHAR` | Not Null                      | آرایه‌ای از روزهای کاری هفته (مثلاً `[6,0,1,2,3]`)     |

---

### جدول: `SpecificHolidays`

برای تعریف تعطیلات خاص و موردی در هر تقویم.

| ستون (Column)     | نوع (Type)         | محدودیت‌ها (Constraints)      | توضیحات (Notes)                  |
|-----------------|---------------------|---------------------------------|-----------------------------------|
| `id`            | `INTEGER` / `SERIAL`  | Primary Key, Not Null           | شناسه منحصر به فرد تعطیلی         |
| `calendar_id`   | `INTEGER`           | Foreign Key -> `Calendars.id`   | شناسه تقویمی که این تعطیلی به آن تعلق دارد |
| `date`          | `DATE`              | Not Null                        | تاریخ روز تعطیل                  |
| `reason`        | `VARCHAR(255)`      | Not Null                        | علت تعطیلی                       |

---

### جدول: `ProjectActivities` (برنامه زمان‌بندی آبشاری)

فعالیت‌های ساختار شکست کار (WBS) برای پروژه‌های آبشاری.

| ستون (Column)        | نوع (Type)                 | محدودیت‌ها (Constraints)          | توضیحات (Notes)                                  |
|----------------------|-----------------------------|-------------------------------------|--------------------------------------------------|
| `id`                 | `VARCHAR(255)`              | Primary Key, Not Null               | شناسه منحصر به فرد فعالیت (مثلاً `task-123`)       |
| `project_id`         | `INTEGER`                   | Foreign Key -> `Projects.id`        | شناسه پروژه‌ای که این فعالیت به آن تعلق دارد   |
| `name`               | `VARCHAR(255)`              | Not Null                            | نام فعالیت                                      |
| `duration`           | `INTEGER`                   | Not Null                            | مدت زمان فعالیت به روز                           |
| `weight`             | `DECIMAL(5, 2)`             | Not Null, Default `0`               | وزن فعالیت در محاسبه پیشرفت کلی                 |
| `actual_progress`    | `INTEGER`                   | Not Null, Default `0`               | درصد پیشرفت واقعی (0-100)                        |
| `parent_id`          | `VARCHAR(255)`              | Foreign Key -> `ProjectActivities.id` | شناسه فعالیت والد برای ایجاد ساختار درختی        |
| `prerequisite_id`    | `VARCHAR(255)`              | Foreign Key -> `ProjectActivities.id` | شناسه فعالیت پیش‌نیاز                           |
| `prerequisite_type`  | `ENUM('FS','SS','FF','SF')` | Default `'FS'`                      | نوع رابطه پیش‌نیازی (Finish-to-Start, etc.)       |
| `lag`                | `INTEGER`                   | Default `0`                         | فاصله زمانی (Lag/Lead) با پیش‌نیاز به روز کاری     |
| `assigned_to_id`     | `INTEGER`                   | Foreign Key -> `Users.id`           | شناسه کاربری که فعالیت به او تخصیص داده شده است   |

---

### جدول: `KanbanTasks` (وظایف چابک)

وظایف موجود در تابلوی کانبان برای پروژه‌های چابک.

| ستون (Column)        | نوع (Type)                       | محدودیت‌ها (Constraints)    | توضیحات (Notes)                                     |
|----------------------|-----------------------------------|-------------------------------|------------------------------------------------------|
| `id`                 | `INTEGER` / `SERIAL`                | Primary Key, Not Null         | شناسه منحصر به فرد وظیفه                             |
| `project_id`         | `INTEGER`                         | Foreign Key -> `Projects.id`  | شناسه پروژه‌ای که این وظیفه به آن تعلق دارد      |
| `description`        | `TEXT`                            | Not Null                      | شرح وظیفه                                           |
| `due_date`           | `DATE`                            |                               | تاریخ سررسید وظیفه                                  |
| `priority`           | `ENUM('Low', 'Medium', 'High')`   | Not Null, Default `'Medium'`  | اولویت وظیفه                                        |
| `status`             | `ENUM('To-Do', 'Doing', 'Done')`  | Not Null, Default `'To-Do'`   | وضعیت وظیفه در تابلوی کانبان                        |
| `assigned_to_id`     | `INTEGER`                         | Foreign Key -> `Users.id`     | شناسه کاربری که وظیفه به او تخصیص داده شده است     |

---

### جدول: `ActionItems` (اقدامات)

برای تعریف و پیگیری اقدامات مستقل یا مرتبط با پروژه‌ها.

| ستون (Column)           | نوع (Type)                                               | محدودیت‌ها (Constraints)      | توضیحات (Notes)                                    |
|-------------------------|-----------------------------------------------------------|---------------------------------|----------------------------------------------------|
| `id`                    | `INTEGER` / `SERIAL`                                      | Primary Key, Not Null           | شناسه منحصر به فرد اقدام                             |
| `title`                 | `VARCHAR(255)`                                            | Not Null                        | عنوان اقدام                                        |
| `description`           | `TEXT`                                                    |                                 | شرح اقدام                                          |
| `responsible_user_id`   | `INTEGER`                                                 | Foreign Key -> `Users.id`       | شناسه کاربر مسئول انجام اقدام                      |
| `approver_id`           | `INTEGER`                                                 | Foreign Key -> `Users.id`       | شناسه کاربر تأییدکننده وضعیت اقدام               |
| `status`                | `ENUM('Planning', 'In Progress', 'On Hold', 'Completed')` | Not Null, Default `'Planning'`  | وضعیت فعلی اقدام                                   |
| `calendar_id`           | `INTEGER`                                                 | Foreign Key -> `Calendars.id`   | شناسه تقویم کاری اقدام                             |
| `start_date`            | `DATE`                                                    | Not Null                        | تاریخ شروع اقدام                                    |
| `end_date`              | `DATE`                                                    | Not Null                        | تاریخ پایان اقدام                                   |
| `owning_unit`           | `VARCHAR(255)`                                            | Not Null                        | واحد سازمانی مالک اقدام                            |
| `project_id`            | `INTEGER`                                                 | Foreign Key -> `Projects.id`    | شناسه پروژه مرتبط (اختیاری)                         |

---

### جدول: `ProgressUpdates` (ثبت پیشرفت و درخواست‌های تأیید)

این جدول تمامی درخواست‌های تأیید مربوط به پیشرفت فعالیت‌ها و تغییرات وضعیت را ذخیره می‌کند.

| ستون (Column)           | نوع (Type)                                       | محدودیت‌ها (Constraints)      | توضیحات (Notes)                                   |
|-------------------------|---------------------------------------------------|---------------------------------|---------------------------------------------------|
| `id`                    | `INTEGER` / `SERIAL`                              | Primary Key, Not Null           | شناسه منحصر به فرد درخواست                       |
| `project_id`            | `INTEGER`                                         | Foreign Key -> `Projects.id`    | شناسه پروژه مرتبط                                 |
| `activity_id`           | `VARCHAR(255)`                                    | Foreign Key -> `ProjectActivities.id` | شناسه فعالیت آبشاری مرتبط (اختیاری)              |
| `task_id`               | `INTEGER`                                         | Foreign Key -> `KanbanTasks.id` | شناسه وظیفه چابک مرتبط (اختیاری)                  |
| `action_id`             | `INTEGER`                                         | Foreign Key -> `ActionItems.id` | شناسه اقدام مرتبط (اختیاری)                       |
| `submitted_by`          | `INTEGER`                                         | Foreign Key -> `Users.id`       | شناسه کاربر ارسال‌کننده                          |
| `submitted_progress`    | `INTEGER`                                         |                                 | درصد پیشرفت ارسالی (برای فعالیت آبشاری)            |
| `submitted_status`      | `VARCHAR(50)`                                     |                                 | وضعیت ارسالی (برای وظایف چابک یا اقدامات)        |
| `current_status`        | `VARCHAR(50)`                                     |                                 | وضعیت فعلی قبل از درخواست تغییر                  |
| `status`                | `ENUM('Pending Approval', 'Approved', 'Rejected')` | Not Null                        | وضعیت درخواست تأیید                              |
| `submission_date`       | `TIMESTAMP`                                       | Not Null                        | تاریخ و زمان ارسال درخواست                        |
| `submission_comment`    | `TEXT`                                            |                                 | توضیحات ارسال‌کننده                              |
| `review_comment`        | `TEXT`                                            |                                 | توضیحات بررسی‌کننده                              |
| `review_date`           | `TIMESTAMP`                                       |                                 | تاریخ و زمان بررسی                                |
| `document_name`         | `VARCHAR(255)`                                    |                                 | نام فایل پیوست شده                               |

---

### جداول Join و سایر جداول مرتبط

برای مدیریت روابط چندبه‌چند، جداول زیر مورد نیاز است:

#### جدول: `ProjectTeamMembers` (Join Table)
| ستون (Column)   | نوع (Type) | محدودیت‌ها (Constraints)              |
|---------------|-------------|-----------------------------------------|
| `project_id`  | `INTEGER`   | Foreign Key -> `Projects.id`, Not Null  |
| `user_id`     | `INTEGER`   | Foreign Key -> `Users.id`, Not Null     |
| **Primary Key** | `(`project_id`, `user_id`)` |                                         |

#### جدول: `ProjectRisks`
| ستون (Column)      | نوع (Type)                     | محدودیت‌ها (Constraints)        |
|------------------|---------------------------------|-----------------------------------|
| `id`             | `INTEGER` / `SERIAL`              | Primary Key, Not Null             |
| `project_id`     | `INTEGER`                       | Foreign Key -> `Projects.id`      |
| `description`    | `TEXT`                          | Not Null                          |
| `probability`    | `ENUM('Low', 'Medium', 'High')` | Not Null                          |
| `impact`         | `ENUM('Low', 'Medium', 'High')` | Not Null                          |
| `response_plan`  | `TEXT`                          | Not Null                          |
| `assigned_to`    | `VARCHAR(255)`                  | Not Null                          |

#### جدول: `ProjectStatusUpdates`
| ستون (Column)   | نوع (Type)         | محدودیت‌ها (Constraints)       |
|---------------|---------------------|----------------------------------|
| `id`          | `INTEGER` / `SERIAL`  | Primary Key, Not Null            |
| `project_id`  | `INTEGER`           | Foreign Key -> `Projects.id`     |
| `description` | `TEXT`              | Not Null                         |
| `date`        | `DATE`              | Not Null                         |

#### جدول: `ProjectDocuments`
| ستون (Column)   | نوع (Type)                                        | محدودیت‌ها (Constraints)      |
|---------------|----------------------------------------------------|---------------------------------|
| `id`          | `INTEGER` / `SERIAL`                               | Primary Key, Not Null           |
| `project_id`  | `INTEGER`                                          | Foreign Key -> `Projects.id`    |
| `name`        | `VARCHAR(255)`                                     | Not Null                        |
| `description` | `TEXT`                                             |                                 |
| `type`        | `ENUM('Letter', 'Meeting Minutes', 'Report', ...)` | Not Null                        |

#### جدول: `ProjectApprovalHistory`
| ستون (Column)   | نوع (Type)                               | محدودیت‌ها (Constraints)      |
|---------------|-------------------------------------------|---------------------------------|
| `id`          | `INTEGER` / `SERIAL`                        | Primary Key, Not Null           |
| `project_id`  | `INTEGER`                                   | Foreign Key -> `Projects.id`    |
| `action`      | `ENUM('Submitted', 'Approved', 'Rejected')` | Not Null                        |
| `date`        | `TIMESTAMP`                                 | Not Null                        |
| `actor`       | `VARCHAR(255)`                              | Not Null                        |
| `comment`     | `TEXT`                                      |                                 |

---

### جداول استراتژی و دانش

#### جدول: `Strategies`
| ستون (Column)      | نوع (Type)        | محدودیت‌ها (Constraints)    |
|------------------|--------------------|-------------------------------|
| `id`             | `VARCHAR(255)`     | Primary Key, Not Null         |
| `name`           | `VARCHAR(255)`     | Not Null                      |
| `description`    | `TEXT`             |                               |
| `weight`         | `DECIMAL(5, 2)`    | Not Null, Default `0`         |
| `parent_id`      | `VARCHAR(255)`     | Foreign Key -> `Strategies.id`|

#### جدول: `ProjectStrategyAlignments` (Join Table)
| ستون (Column)   | نوع (Type)                          | محدودیت‌ها (Constraints)         |
|---------------|--------------------------------------|------------------------------------|
| `project_id`  | `INTEGER`                            | Foreign Key -> `Projects.id`       |
| `strategy_id` | `VARCHAR(255)`                       | Foreign Key -> `Strategies.id`     |
| `level`       | `ENUM('None', 'Low', 'Medium', ...)` | Not Null                           |
| **Primary Key** | `(`project_id`, `strategy_id`)`      |                                    |

#### جدول: `KnowledgeDocuments`
| ستون (Column)   | نوع (Type)                                       | محدودیت‌ها (Constraints)    |
|---------------|---------------------------------------------------|-------------------------------|
| `id`          | `INTEGER` / `SERIAL`                                | Primary Key, Not Null         |
| `name`        | `VARCHAR(255)`                                    | Not Null                      |
| `description` | `TEXT`                                            |                               |
| `type`        | `ENUM('Book', 'Pamphlet', 'Software', 'Other')`   | Not Null                      |
