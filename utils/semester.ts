export interface SemesterInfo {
  semesterStart: string;  // "YYYY-MM-DD"
  semesterEnd: string;    // "YYYY-MM-DD"
  label: string;          // e.g. "114 學年度上學期"
}

export const getCurrentSemester = (date: Date = new Date()): SemesterInfo => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();

  // Month-day as comparable number (e.g. 901 for Sep 1, 120 for Jan 20)
  const md = month * 100 + day;

  if (md >= 901) {
    // Sep 1 ~ Dec 31 → first semester of current academic year
    const academicYear = year - 1911;
    return {
      semesterStart: `${year}-09-01`,
      semesterEnd: `${year + 1}-01-20`,
      label: `${academicYear} 學年度上學期`,
    };
  } else if (md <= 120) {
    // Jan 1 ~ Jan 20 → first semester of previous calendar year's academic year
    const academicYear = year - 1 - 1911;
    return {
      semesterStart: `${year - 1}-09-01`,
      semesterEnd: `${year}-01-20`,
      label: `${academicYear} 學年度上學期`,
    };
  } else if (md <= 210) {
    // Jan 21 ~ Feb 10 → winter break, still counts as first semester
    const academicYear = year - 1 - 1911;
    return {
      semesterStart: `${year - 1}-09-01`,
      semesterEnd: `${year}-01-20`,
      label: `${academicYear} 學年度上學期`,
    };
  } else if (md <= 630) {
    // Feb 11 ~ Jun 30 → second semester
    const academicYear = year - 1 - 1911;
    return {
      semesterStart: `${year}-02-11`,
      semesterEnd: `${year}-06-30`,
      label: `${academicYear} 學年度下學期`,
    };
  } else {
    // Jul 1 ~ Aug 31 → summer break, still counts as second semester
    const academicYear = year - 1 - 1911;
    return {
      semesterStart: `${year}-02-11`,
      semesterEnd: `${year}-06-30`,
      label: `${academicYear} 學年度下學期`,
    };
  }
};
