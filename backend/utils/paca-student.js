/**
 * Paca Student Helper
 * - Decrypt name/phone from Paca DB
 * - Convert gender format (male/female -> M/F)
 * - Handles aliased fields (student_name, student_gender, parent_phone)
 */

const { decrypt } = require("./encryption");

function decryptStudentFields(rows) {
  return rows.map(r => {
    const result = { ...r };
    if (r.name !== undefined) result.name = r.name ? decrypt(r.name) : null;
    if (r.student_name !== undefined) result.student_name = r.student_name ? decrypt(r.student_name) : null;
    if (r.phone !== undefined) result.phone = r.phone ? decrypt(r.phone) : null;
    if (r.parent_phone !== undefined) result.parent_phone = r.parent_phone ? decrypt(r.parent_phone) : null;
    if (r.gender !== undefined) {
      result.gender = r.gender === "male" ? "M" : r.gender === "female" ? "F" : r.gender;
    }
    if (r.student_gender !== undefined) {
      result.student_gender = r.student_gender === "male" ? "M" : r.student_gender === "female" ? "F" : r.student_gender;
    }
    return result;
  });
}

function decryptStudentName(row) {
  if (!row) return row;
  return { ...row, name: row.name ? decrypt(row.name) : null };
}

module.exports = { decryptStudentFields, decryptStudentName };
