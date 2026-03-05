import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove,
  writeBatch,
  addDoc,
  getDocs,
  query,
  where,
  getDoc,
} from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, User } from 'firebase/auth';
import { db } from '../firebase';
import { Student, PointLog, ClassConfig, BehaviorButton, DaySchedule, DailyRecord, AbsenceType, Announcement, PrizeItem } from '../types';

// --- Student CRUD ---

export const subscribeToStudents = (
  userUid: string,
  callback: (students: Student[]) => void
) => {
  const studentsRef = collection(db, `users/${userUid}/students`);
  return onSnapshot(studentsRef, (snapshot) => {
    const studentList = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Student[];
    studentList.sort((a, b) => {
      const orderA = a.order ?? 99999;
      const orderB = b.order ?? 99999;
      if (orderA !== orderB) return orderA - orderB;
      return a.id.localeCompare(b.id);
    });
    callback(studentList);
  });
};

export const subscribeToConfig = (
  userUid: string,
  callback: (config: ClassConfig) => void
) => {
  const configRef = doc(db, `users/${userUid}/settings/config`);
  return onSnapshot(configRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as ClassConfig);
    } else {
      setDoc(configRef, { class_board: '' });
    }
  });
};

export const addPointToStudent = async (
  userUid: string,
  studentId: string,
  currentDate: string,
  currentDayRecord: DailyRecord,
  behavior: { label: string; value: number }
) => {
  const studentRef = doc(db, `users/${userUid}/students/${studentId}`);
  const newPoint: PointLog = { id: crypto.randomUUID(), label: behavior.label, value: behavior.value, timestamp: Date.now() };
  const updatedPoints = [...currentDayRecord.points, newPoint];
  await updateDoc(studentRef, {
    totalScore: increment(behavior.value),
    [`dailyRecords.${currentDate}`]: { points: updatedPoints, note: currentDayRecord.note, absence: currentDayRecord.absence ?? null }
  });
};

export const addPointToAllStudents = async (
  userUid: string,
  students: Student[],
  currentDate: string,
  behavior: { label: string; value: number }
): Promise<number> => {
  const batch = writeBatch(db);
  let count = 0;
  for (const student of students) {
    const currentDayRecord = student.dailyRecords[currentDate] || { points: [], note: '', absence: null };
    if (currentDayRecord.absence) continue;
    const studentRef = doc(db, `users/${userUid}/students/${student.id}`);
    const newPoint: PointLog = { id: crypto.randomUUID(), label: behavior.label, value: behavior.value, timestamp: Date.now() };
    const updatedPoints = [...currentDayRecord.points, newPoint];
    batch.update(studentRef, {
      totalScore: increment(behavior.value),
      [`dailyRecords.${currentDate}`]: { points: updatedPoints, note: currentDayRecord.note, absence: currentDayRecord.absence ?? null }
    });
    count++;
  }
  await batch.commit();
  return count;
};

export const deletePointFromStudent = async (
  userUid: string,
  studentId: string,
  currentDate: string,
  currentDayRecord: DailyRecord,
  pointId: string,
  pointValue: number
) => {
  const studentRef = doc(db, `users/${userUid}/students/${studentId}`);
  const updatedPoints = currentDayRecord.points.filter(p => p.id !== pointId);
  await updateDoc(studentRef, {
    totalScore: increment(-pointValue),
    [`dailyRecords.${currentDate}`]: { points: updatedPoints, note: currentDayRecord.note, absence: currentDayRecord.absence ?? null }
  });
};

export const toggleStudentTag = async (
  userUid: string,
  studentId: string,
  tag: string,
  currentTags: string[]
) => {
  const studentRef = doc(db, `users/${userUid}/students/${studentId}`);
  if (currentTags.includes(tag)) {
    await updateDoc(studentRef, { tags: arrayRemove(tag) });
  } else {
    await updateDoc(studentRef, { tags: arrayUnion(tag) });
  }
};

export const updateStudentComment = async (
  userUid: string,
  studentId: string,
  comment: string,
  originalAiComment?: string
) => {
  const studentRef = doc(db, `users/${userUid}/students/${studentId}`);
  const updateData: Record<string, string> = { comment };
  if (originalAiComment !== undefined) {
    updateData.originalAiComment = originalAiComment;
  }
  await updateDoc(studentRef, updateData);
};

export const saveStudentNote = async (
  userUid: string,
  studentId: string,
  currentDate: string,
  currentDayRecord: DailyRecord,
  note: string
) => {
  const studentRef = doc(db, `users/${userUid}/students/${studentId}`);
  await updateDoc(studentRef, {
    [`dailyRecords.${currentDate}`]: { points: currentDayRecord.points, note, absence: currentDayRecord.absence ?? null }
  });
};

export const setStudentAbsence = async (
  userUid: string,
  studentId: string,
  currentDate: string,
  currentDayRecord: DailyRecord,
  absence: AbsenceType | null
) => {
  const studentRef = doc(db, `users/${userUid}/students/${studentId}`);
  await updateDoc(studentRef, {
    [`dailyRecords.${currentDate}`]: {
      points: currentDayRecord.points,
      note: currentDayRecord.note,
      absence,
    }
  });
};

export const updateStudentName = async (userUid: string, studentId: string, newName: string) => {
  const ref = doc(db, `users/${userUid}/students/${studentId}`);
  await updateDoc(ref, { name: newName });
};

export const updateStudentSeatNumber = async (userUid: string, studentId: string, seatNumber: number) => {
  const ref = doc(db, `users/${userUid}/students/${studentId}`);
  await updateDoc(ref, { seatNumber });
};

export const setStudentScore = async (userUid: string, studentId: string, newScore: number) => {
  const ref = doc(db, `users/${userUid}/students/${studentId}`);
  await updateDoc(ref, { totalScore: newScore });
};

export const importStudents = async (userUid: string, names: string[], existingCount: number) => {
  const batch = writeBatch(db);
  names.forEach((name, idx) => {
    const newRef = doc(collection(db, `users/${userUid}/students`));
    const newStudent: Student = {
      id: newRef.id,
      name,
      order: existingCount + idx + 1,
      seatNumber: existingCount + idx + 1,
      totalScore: 0,
      tags: [],
      comment: '',
      dailyRecords: {}
    };
    batch.set(newRef, newStudent);
  });
  await batch.commit();
};

export const deleteStudents = async (
  user: User,
  password: string,
  studentIds: string[]
) => {
  if (!user.email) throw new Error('No email');
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);

  const batch = writeBatch(db);
  studentIds.forEach(id => {
    const ref = doc(db, `users/${user.uid}/students/${id}`);
    batch.delete(ref);
  });
  await batch.commit();
};

// --- Config CRUD ---

export const updateClassConfig = async (userUid: string, config: ClassConfig) => {
  const ref = doc(db, `users/${userUid}/settings/config`);
  await setDoc(ref, config, { merge: true });
};

export const updateCustomBehaviors = async (
  userUid: string,
  currentConfig: ClassConfig,
  type: 'positive' | 'negative',
  newBtns: BehaviorButton[],
  positiveBehaviors: BehaviorButton[],
  negativeBehaviors: BehaviorButton[]
) => {
  const updatedBehaviors = {
    positive: type === 'positive' ? newBtns : positiveBehaviors,
    negative: type === 'negative' ? newBtns : negativeBehaviors
  };
  const newConfig = { ...currentConfig, customBehaviors: updatedBehaviors };
  const ref = doc(db, `users/${userUid}/settings/config`);
  await setDoc(ref, newConfig, { merge: true });
  return newConfig;
};

export const updatePrizes = async (
  userUid: string,
  currentConfig: ClassConfig,
  newPrizes: PrizeItem[]
) => {
  const newConfig = { ...currentConfig, prizes: newPrizes };
  const ref = doc(db, `users/${userUid}/settings/config`);
  await setDoc(ref, newConfig, { merge: true });
  return newConfig;
};

// --- Research Logging ---

export const logAiGeneration = async (
  userUid: string,
  studentId: string,
  lengthSetting: number,
  hasCustomPrompt: boolean
) => {
  const logRef = collection(db, `users/${userUid}/logs`);
  await addDoc(logRef, {
    studentId,
    type: 'ai_generate',
    timestamp: Date.now(),
    lengthSetting,
    hasCustomPrompt
  });
};

// 查詢今日 AI 使用次數（rate limiting 用）
export const getTodayAiGenerationCount = async (userUid: string): Promise<number> => {
  const logRef = collection(db, `users/${userUid}/logs`);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const q = query(logRef, where('timestamp', '>=', startOfToday.getTime()));
  const snapshot = await getDocs(q);
  return snapshot.size;
};

// 記錄課表辨識使用（與 logAiGeneration 同 collection）
export const logScheduleRecognition = async (userUid: string) => {
  const logRef = collection(db, `users/${userUid}/logs`);
  await addDoc(logRef, {
    type: 'schedule_recognize',
    timestamp: Date.now(),
  });
};

export const logCommentEdit = async (
  userUid: string,
  studentId: string,
  data: {
    type: string;
    originalLength: number;
    finalLength: number;
    editDistance: number;
    lengthSetting: number;
  }
) => {
  const logRef = collection(db, `users/${userUid}/research_logs`);
  await addDoc(logRef, {
    studentId,
    timestamp: Date.now(),
    ...data
  });
};

// --- Secure Verification ---

export const verifyPassword = async (user: User, password: string) => {
  if (!user.email) throw new Error('No email');
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);
};

// --- Semester Archive ---

export const archiveSemester = async (user: User, password: string) => {
  if (!user.email) throw new Error('No email');
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);

  const studentsSnap = await getDocs(collection(db, `users/${user.uid}/students`));
  const batch = writeBatch(db);
  studentsSnap.docs.forEach(d => {
    batch.update(d.ref, { totalScore: 0, dailyRecords: {} });
  });
  await batch.commit();
};

// --- Announcements ---

export const subscribeToAnnouncements = (
  callback: (announcements: Announcement[]) => void
) => {
  const announcementsRef = collection(db, 'announcements');
  const q = query(announcementsRef, where('active', '==', true));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Announcement[];
    list.sort((a, b) => b.createdAt - a.createdAt);
    callback(list);
  });
};

export const getReadAnnouncementIds = async (userUid: string): Promise<string[]> => {
  const ref = doc(db, `users/${userUid}/settings/readAnnouncements`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const data = snap.data();
  return Object.keys(data).filter(k => data[k] === true);
};

export const subscribeToReadAnnouncements = (
  userUid: string,
  callback: (ids: string[]) => void
) => {
  const ref = doc(db, `users/${userUid}/settings/readAnnouncements`);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      callback([]);
      return;
    }
    const data = snap.data();
    callback(Object.keys(data).filter(k => data[k] === true));
  });
};

export const markAnnouncementAsRead = async (userUid: string, announcementId: string) => {
  const ref = doc(db, `users/${userUid}/settings/readAnnouncements`);
  await setDoc(ref, { [announcementId]: true }, { merge: true });
};
