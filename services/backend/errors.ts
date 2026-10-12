import type { ApiError } from '../api';

const FIELD_FA: Record<string, string> = {
  name: 'عنوان پروژه', manager: 'مدیر پروژه', unit: 'واحد متولی', start_date: 'تاریخ شروع', end_date: 'تاریخ پایان',
  goal: 'هدف پروژه', requirements: 'الزامات پروژه', constraints: 'محدودیت‌ها و مفروضات', assumptions: 'محدودیت‌ها و مفروضات', description: 'توضیحات'
};
const FIELD_EN: Record<string, string> = {
  name: 'Project Name', manager: 'Project Manager', unit: 'Owning Unit', start_date: 'Start Date', end_date: 'End Date',
  goal: 'Project Goal', requirements: 'Project Requirements', constraints: 'Constraints & Assumptions', assumptions: 'Constraints & Assumptions', description: 'Description'
};

/**
 * The words for the backend's project rules in the language of the screen. The rules themselves (and which one failed) come from the
 * backend as an error code; anything this does not know is shown with the backend's own message.
 */
export function projectErrorText(error: Pick<ApiError, 'code' | 'message'>, language: string, nameExistsText: string): string {
  const fa = language === 'fa';
  if (error.code === 'project.name_exists') return nameExistsText;

  const required = /^project\.charter\.(\w+)_required$/.exec(error.code);
  if (required) {
    const label = (fa ? FIELD_FA : FIELD_EN)[required[1]] ?? required[1];
    return fa ? `«${label}» الزامی است.` : `"${label}" is required.`;
  }

  const meaningless = /^project\.charter\.(\w+)_meaningless$/.exec(error.code);
  if (meaningless) {
    const label = (fa ? FIELD_FA : FIELD_EN)[meaningless[1]] ?? meaningless[1];
    return fa
      ? `اطلاعات ثبت شده در "${label}" معتبر نمی‌باشد. لطفاً توضیحات واقعی و مرتبط با عنوان پروژه ثبت کنید.`
      : `Invalid or meaningless text in "${label}". Please enter valid details related to the project title.`;
  }

  return error.message;
}
