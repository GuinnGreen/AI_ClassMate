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
  runTransaction,
} from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { Student, PointLog, ClassConfig, BehaviorButton, DaySchedule, DailyRecord, AbsenceType, Announcement, PrizeItem, CorrectionItem } from '../types';

// --- Student CRUD ---

export const subscribeToStudents = (
  userUid: string,
  callback: (students: Student[]) => void,
  onError?: (err: Error) => void,
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
  }, (err) => { console.error('[subscribeToStudents] 學生資料同步失敗', err); onError?.(err); });
};

export const subscribeToConfig = (
  userUid: string,
  callback: (config: ClassConfig) => void,
  onError?: (err: Error) => void,
) => {
  const configRef = doc(db, `users/${userUid}/settings/config`);
  return onSnapshot(configRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as ClassConfig);
    } else {
      setDoc(configRef, { class_board: '' });
    }
  }, (err) => { console.error('[subscribeToConfig] 班級設定同步失敗', err); onError?.(err); });
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
  // 以 transaction 讀取伺服器最新當日紀錄，避免多裝置同時操作時互相覆蓋
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(studentRef);
    if (!snap.exists()) throw new Error('學生資料不存在');
    const serverRecord: DailyRecord =
      (snap.data().dailyRecords?.[currentDate] as DailyRecord | undefined) ?? currentDayRecord;
    transaction.update(studentRef, {
      totalScore: increment(behavior.value),
      [`dailyRecords.${currentDate}`]: {
        points: [...serverRecord.points, newPoint],
        note: serverRecord.note,
        absence: serverRecord.absence ?? null,
      },
    });
  });
};

export const addPointToAllStudents = async (
  userUid: string,
  students: Student[],
  currentDate: string,
  behavior: { label: string; value: number }
): Promise<number> => {
  const studentRefs = students.map(student =>
    doc(db, `users/${userUid}/students/${student.id}`)
  );

  return runTransaction(db, async (transaction) => {
    // Firestore requires all transaction reads before writes. Reading every class member
    // first also preserves the previous all-or-nothing batch behavior for normal class sizes.
    const snapshots = [];
    for (const studentRef of studentRefs) {
      snapshots.push(await transaction.get(studentRef));
    }

    let count = 0;
    for (let index = 0; index < snapshots.length; index++) {
      const snapshot = snapshots[index];
      if (!snapshot.exists()) throw new Error('學生資料不存在');
      const data = snapshot.data() as Student;
      const serverRecord = data.dailyRecords?.[currentDate];
      if (serverRecord?.absence) continue;

      const newPoint: PointLog = {
        id: crypto.randomUUID(),
        label: behavior.label,
        value: behavior.value,
        timestamp: Date.now(),
      };
      transaction.update(studentRefs[index], {
        totalScore: (data.totalScore ?? 0) + behavior.value,
        [`dailyRecords.${currentDate}`]: {
          ...(serverRecord ?? {}),
          points: [...(serverRecord?.points ?? []), newPoint],
        },
      });
      count++;
    }
    return count;
  });
};

export const deletePointFromStudent = async (
  userUid: string,
  studentId: string,
  currentDate: string,
  _currentDayRecord: DailyRecord,
  pointId: string,
  _pointValue: number
) => {
  const studentRef = doc(db, `users/${userUid}/students/${studentId}`);
  // 以 transaction 讀取伺服器最新紀錄：扣分金額以伺服器上該筆 point 為準，
  // 若該筆已被其他裝置刪除則直接略過，避免重複扣分
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(studentRef);
    if (!snap.exists()) throw new Error('學生資料不存在');
    const serverRecord = snap.data().dailyRecords?.[currentDate] as DailyRecord | undefined;
    if (!serverRecord) return;
    const targetPoint = serverRecord.points.find(p => p.id === pointId);
    if (!targetPoint) return;
    transaction.update(studentRef, {
      totalScore: increment(-targetPoint.value),
      [`dailyRecords.${currentDate}`]: {
        points: serverRecord.points.filter(p => p.id !== pointId),
        note: serverRecord.note,
        absence: serverRecord.absence ?? null,
      },
    });
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
  _currentDayRecord: DailyRecord,
  note: string
) => {
  const studentRef = doc(db, `users/${userUid}/students/${studentId}`);
  await updateDoc(studentRef, {
    [`dailyRecords.${currentDate}.note`]: note,
  });
};

export const appendStudentNote = async (
  userUid: string,
  studentId: string,
  currentDate: string,
  note: string,
) => {
  const studentRef = doc(db, `users/${userUid}/students/${studentId}`);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(studentRef);
    if (!snapshot.exists()) throw new Error('學生資料不存在');
    const serverRecord = snapshot.data().dailyRecords?.[currentDate] as DailyRecord | undefined;
    const serverNote = serverRecord?.note?.trim() ?? '';
    transaction.update(studentRef, {
      [`dailyRecords.${currentDate}.note`]: serverNote
        ? `${serverNote}\n---\n${note}`
        : note,
    });
  });
};

export const setStudentAbsence = async (
  userUid: string,
  studentId: string,
  currentDate: string,
  _currentDayRecord: DailyRecord,
  absence: AbsenceType | null
) => {
  const studentRef = doc(db, `users/${userUid}/students/${studentId}`);
  await updateDoc(studentRef, {
    [`dailyRecords.${currentDate}.absence`]: absence,
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
// 注：logAiGeneration 與 logScheduleRecognition 已遷移至 Cloud Functions
// (functions/src/index.ts 的 generateText / parseSchedule callable 內部寫 logs)
// Workstream A 由使用者子樹外的伺服器 counter 強制執行配額；既有 logs 保留供稽核與 UI 相容。
// 將 logs 改為伺服器專用的 Rules 強化仍屬 Workstream B。

export interface AiQuotaUsageSnapshot {
  used: number;
  limit: number;
  dayKey: string;
  startMs: number;
  endMs: number;
  serverNowMs: number;
}

// 由後端 callable 依 Asia/Taipei 配額日回傳 counter 與日界線；前端不自行推算日期。
export const getAiQuotaUsageSnapshot = async (userUid: string): Promise<AiQuotaUsageSnapshot> => {
  if (!userUid) {
    throw new Error('缺少使用者識別，無法讀取 AI 配額');
  }
  const readQuotaUsage = httpsCallable<
    Record<string, never>,
    AiQuotaUsageSnapshot
  >(functions, 'getAiQuotaUsage');
  const result = await readQuotaUsage({});
  const usage = result.data;
  if (
    !Number.isFinite(usage.used) || usage.used < 0
    || !Number.isFinite(usage.limit) || usage.limit <= 0
    || !/^\d{4}-\d{2}-\d{2}$/.test(usage.dayKey)
    || !Number.isFinite(usage.startMs)
    || !Number.isFinite(usage.endMs)
    || !Number.isFinite(usage.serverNowMs)
    || usage.startMs >= usage.endMs
    || usage.serverNowMs < usage.startMs
    || usage.serverNowMs >= usage.endMs
  ) {
    throw new Error('後端回傳無效的 AI 配額用量');
  }
  return usage;
};

export const getTodayAiGenerationCount = async (userUid: string): Promise<number> => {
  if (!userUid) return 0;
  return (await getAiQuotaUsageSnapshot(userUid)).used;
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

  // archiveId: ISO 時間戳替換非法字元（: 與 . 會破壞 Firestore doc id）
  const archivedAt = Date.now();
  const archiveId = new Date(archivedAt).toISOString().replace(/[:.]/g, '-');

  const batch = writeBatch(db);

  // 1. archive metadata（記錄封存時間 + 學生數）
  const metaRef = doc(db, `users/${user.uid}/archives/${archiveId}`);
  batch.set(metaRef, {
    archivedAt,
    studentCount: studentsSnap.docs.length,
  });

  // 2. 每個學生：先寫整份 doc 備份到 archives subcollection，再清空當前
  studentsSnap.docs.forEach(d => {
    const backupRef = doc(db, `users/${user.uid}/archives/${archiveId}/students/${d.id}`);
    batch.set(backupRef, { ...d.data(), archivedAt });
    batch.update(d.ref, { totalScore: 0, dailyRecords: {} });
  });

  await batch.commit();
};

// --- Announcements ---

export const subscribeToAnnouncements = (
  callback: (announcements: Announcement[]) => void,
  onError?: (err: Error) => void,
) => {
  const announcementsRef = collection(db, 'announcements');
  const q = query(announcementsRef, where('active', '==', true));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Announcement[];
    list.sort((a, b) => b.createdAt - a.createdAt);
    callback(list);
  }, (err) => { console.error('[subscribeToAnnouncements] 公告同步失敗', err); onError?.(err); });
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
  callback: (ids: string[]) => void,
  onError?: (err: Error) => void,
) => {
  const ref = doc(db, `users/${userUid}/settings/readAnnouncements`);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      callback([]);
      return;
    }
    const data = snap.data();
    callback(Object.keys(data).filter(k => data[k] === true));
  }, (err) => { console.error('[subscribeToReadAnnouncements] 已讀狀態同步失敗', err); onError?.(err); });
};

export const markAnnouncementAsRead = async (userUid: string, announcementId: string) => {
  const ref = doc(db, `users/${userUid}/settings/readAnnouncements`);
  await setDoc(ref, { [announcementId]: true }, { merge: true });
};

// --- Corrections (訂正追蹤) ---

export const subscribeToCorrections = (
  userUid: string,
  callback: (corrections: CorrectionItem[]) => void,
  onError?: (err: Error) => void,
) => {
  const correctionsRef = collection(db, `users/${userUid}/corrections`);
  return onSnapshot(correctionsRef, (snapshot) => {
    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as CorrectionItem[];
    list.sort((a, b) => a.createdAt - b.createdAt);
    callback(list);
  }, (err) => { console.error('[subscribeToCorrections] 訂正資料同步失敗', err); onError?.(err); });
};

export const addCorrectionBatch = async (
  userUid: string,
  studentIds: string[],
  label: string
) => {
  const batch = writeBatch(db);
  const now = Date.now();
  for (const studentId of studentIds) {
    const ref = doc(collection(db, `users/${userUid}/corrections`));
    batch.set(ref, { studentId, label, createdAt: now });
  }
  await batch.commit();
};

export const deleteCorrection = async (userUid: string, correctionId: string) => {
  const batch = writeBatch(db);
  const ref = doc(db, `users/${userUid}/corrections/${correctionId}`);
  batch.delete(ref);
  await batch.commit();
};

export const deleteCorrectionsByLabel = async (userUid: string, label: string, corrections: CorrectionItem[]) => {
  const toDelete = corrections.filter(c => c.label === label);
  const batch = writeBatch(db);
  for (const c of toDelete) {
    batch.delete(doc(db, `users/${userUid}/corrections/${c.id}`));
  }
  await batch.commit();
};
