import { db, auth } from './config.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function saveCenterDataToFirebase(data) {
  try {
    const user = auth ? auth.currentUser : null;
    if (!user) return;

    const reportRef = doc(db, "reports", user.uid);
    await setDoc(reportRef, {
      ...data,
      userId: user.uid,
      userEmail: user.email || '',
      updatedAt: new Date()
    }, { merge: true });
  } catch (error) {
    console.error("خطأ أثناء حفظ التقرير في Firestore:", error);
  }
}

export async function getCenterDataFromFirebase() {
  try {
    const user = auth ? auth.currentUser : null;
    if (!user) return null;

    const reportRef = doc(db, "reports", user.uid);
    const docSnap = await getDoc(reportRef);

    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error("خطأ أثناء جلب التقرير من Firestore:", error);
    return null;
  }
}
