import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  updateDoc,
  query,
  where,
  getDocs,
  writeBatch,
  setDoc
} from '@angular/fire/firestore';
import { first, map } from 'rxjs';

import { Empleado } from '../models/empleado.model';
import { RegistroEmpleado } from '../models/registro_empleado.model';

// ✅ Crear usuarios sin cerrar sesión del admin (Firebase app secundario)
import { initializeApp, deleteApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { environment } from '../../environments/environment.development';

@Injectable({
  providedIn: 'root'
})
export class EmpleadoService {
  private db = inject(Firestore);
  private injector = inject(Injector);

  private readonly empleadosCol = 'empleado';
  private readonly usersCol = 'users';
  private readonly registroCol = 'registroempleado';

  // ===== EMPLEADOS =====
  getEmpleados() {
    return runInInjectionContext(this.injector, () => {
      const colRef = collection(this.db, this.empleadosCol);
      return collectionData(colRef, { idField: 'id' }).pipe(
        map((data: any[]) =>
          data.map(d => ({
            id: d.id,
            nombre: d.nombre ?? '',
            email: d.email ?? '',
            role: (d.role === 'admin' || d.role === 'employee') ? d.role : 'employee'
          } as Empleado))
        ),
        first()
      );
    });
  }

  async crearEmpleado(nombre: string) {
    // (Legacy) solo Firestore
    const colRef = collection(this.db, this.empleadosCol);
    const data = { nombre: nombre.trim() };
    const docRef = await addDoc(colRef, data as any);
    return { id: docRef.id, ...data } as Empleado;
  }

  /**
   * ✅ ALTA COMPLETA (SIN BLAZE):
   * 1) Crea cuenta en Firebase Auth (sin cerrar sesión del admin) usando una app secundaria.
   * 2) Crea perfil en /users/{uid} con role.
   * 3) Crea/actualiza doc en /empleado/{uid} para el listado.
   */
  async crearEmpleadoConCuenta(payload: { nombre: string; email: string; passwordTemporal: string; role: 'admin' | 'employee' }) {
    const nombre = payload.nombre.trim();
    const email = payload.email.trim().toLowerCase();

    // App secundaria (evita tumbar sesión)
    const secondaryName = 'secondary-auth';
    const already = getApps().find(a => a.name === secondaryName);
    const secondaryApp = already ?? initializeApp(environment.firebaseConfig, secondaryName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      // 1) Crear usuario
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, payload.passwordTemporal);
      const uid = cred.user.uid;

      // 2) (Recomendado) enviar reset password para que el usuario ponga su propia contraseña
      // Nota: si no quieres email, comenta estas 2 líneas.
      await sendPasswordResetEmail(secondaryAuth, email);
      await signOut(secondaryAuth);

      // 3) Guardar perfil /users/{uid}
      await setDoc(doc(this.db, this.usersCol, uid), {
        email,
        role: payload.role,
        nombre,
        active: true,
        createdAt: new Date().toISOString()
      } as any);

      // 4) Guardar en /empleado/{uid} (para tu listado)
      await setDoc(doc(this.db, this.empleadosCol, uid), {
        nombre,
        email,
        role: payload.role,
        active: true,
        createdAt: new Date().toISOString()
      } as any);

      return { uid };
    } finally {
      // Si la app secundaria la creamos nosotros aquí, podríamos borrarla.
      // Pero si ya existe (reutilizada), no la borres.
      if (!already) {
        try { await deleteApp(secondaryApp); } catch {}
      }
    }
  }

  async actualizarEmpleado(id: string, nombre: string) {
    const docRef = doc(this.db, this.empleadosCol, id);
    return updateDoc(docRef, { nombre: nombre.trim() } as any);
  }

  async eliminarEmpleado(id: string) {
    const docRef = doc(this.db, this.empleadosCol, id);
    return deleteDoc(docRef);
  }

  // ===== REGISTROS (por fecha) =====
  getRegistrosByFecha(fechaKey: string) {
    return runInInjectionContext(this.injector, () => {
      const colRef = collection(this.db, this.registroCol);
      const qRef = query(colRef, where('fechaKey', '==', fechaKey));

      return collectionData(qRef as any, { idField: 'id' }).pipe(
        map((data: any[]) => data.map(d => d as RegistroEmpleado)),
        first()
      );
    });
  }

  async crearRegistro(r: RegistroEmpleado) {
    const colRef = collection(this.db, this.registroCol);
    const docRef = await addDoc(colRef, r as any);
    return { ...r, id: docRef.id } as RegistroEmpleado;
  }

  async actualizarRegistro(id: string, patch: Partial<RegistroEmpleado>) {
    const docRef = doc(this.db, this.registroCol, id);
    return updateDoc(docRef, patch as any);
  }

  async eliminarRegistro(id: string) {
    const docRef = doc(this.db, this.registroCol, id);
    return deleteDoc(docRef);
  }

  /**
   * ✅ Upsert por ID (útil para 1 registro por día+empleado).
   * setDoc con merge evita fallos si el doc aún no existe.
   */
  async upsertRegistroById(id: string, data: Partial<RegistroEmpleado>) {
    const ref = doc(this.db, this.registroCol, id);
    return setDoc(ref, data as any, { merge: true } as any);
  }

  // ===== OPCIÓN 2: Eliminar empleado + TODOS sus registros =====
  async eliminarEmpleadoConRegistros(empleadoId: string): Promise<void> {
    const empRef = doc(this.db, this.empleadosCol, empleadoId);

    const regColRef = collection(this.db, this.registroCol);
    const qRef = query(regColRef, where('empleadoId', '==', empleadoId));
    const snap = await getDocs(qRef as any);

    const batch = writeBatch(this.db);

    snap.forEach(d => {
      batch.delete(d.ref);
    });

    batch.delete(empRef);

    await batch.commit();
  }
}
