const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(str) {
  if (!DATE_REGEX.test(str)) return false;
  const d = new Date(str);
  return d instanceof Date && !isNaN(d.getTime());
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates an individual CalendarNote item.
 * Returns null on success, or an Arabic error string on failure.
 */
export function validateNote(item, index) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return `العنصر ${index + 1}: يجب أن يكون كائناً`;
  }
  if (typeof item.id !== 'string' || item.id.trim().length === 0) {
    return `العنصر ${index + 1}: الحقل "id" مطلوب ويجب أن يكون نصاً`;
  }
  if (typeof item.date !== 'string' || !ISO_DATE_RE.test(item.date)) {
    return `العنصر ${index + 1}: الحقل "date" يجب أن يكون بصيغة YYYY-MM-DD`;
  }
  if (typeof item.text !== 'string') {
    return `العنصر ${index + 1}: الحقل "text" مطلوب ويجب أن يكون نصاً`;
  }
  if (item.text.length > 4000) {
    return `العنصر ${index + 1}: الحقل "text" تجاوز الحد المسموح (4000 حرف)`;
  }
  if (!Array.isArray(item.tags)) {
    return `العنصر ${index + 1}: الحقل "tags" يجب أن يكون مصفوفة`;
  }
  if (item.tags.some((t) => typeof t !== 'string')) {
    return `العنصر ${index + 1}: كل عنصر في "tags" يجب أن يكون نصاً`;
  }
  if (typeof item.createdAt !== 'string' || item.createdAt.trim().length === 0) {
    return `العنصر ${index + 1}: الحقل "createdAt" مطلوب`;
  }
  if (typeof item.updatedAt !== 'string' || item.updatedAt.trim().length === 0) {
    return `العنصر ${index + 1}: الحقل "updatedAt" مطلوب`;
  }
  if ('isPinned' in item && typeof item.isPinned !== 'boolean') {
    return `العنصر ${index + 1}: الحقل "isPinned" يجب أن يكون قيمة منطقية (boolean)`;
  }
  return null;
}
