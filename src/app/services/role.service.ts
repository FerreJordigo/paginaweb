import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { Observable, from, of } from 'rxjs';
import { switchMap, map, shareReplay } from 'rxjs/operators';

export type UserRole = 'admin' | 'employee' | null;

@Injectable({
  providedIn: 'root'
})
export class RoleService {
  private db = inject(Firestore);
  private authService = inject(AuthService);
  private injector = inject(EnvironmentInjector); // Inyectamos el contexto de Angular

  /** Rol del usuario autenticado (cacheado). */
  readonly role$: Observable<UserRole> = this.authService.user$.pipe(
    switchMap((u) => {
      if (!u) return of(null);
      return from(this.getRoleByUid(u.uid));
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  async getRoleByUid(uid: string): Promise<UserRole> {
    return runInInjectionContext(this.injector, async () => {
      try {
        console.log('🔍 1. Buscando rol para el UID:', uid);
        const ref = doc(this.db, 'users', uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          console.log('❌ 2. El documento NO existe en la colección "users" con ese UID.');
          return null;
        }

        const data = snap.data() as any;
        console.log('✅ 3. Datos encontrados en Firestore:', data);

        const role = data?.role;
        console.log('🕵️‍♂️ 4. Rol evaluado:', role);

        if (role === 'admin' || role === 'employee') {
           console.log('🎉 5. ¡Rol aceptado!');
           return role;
        }

        console.log('🚫 6. El rol no es válido. Debe ser "admin" o "employee".');
        return null;

      } catch (error) {
        console.error('🔥 Error crítico al leer Firestore:', error);
        return null;
      }
    });
  }

  isAdmin$(): Observable<boolean> {
    return this.role$.pipe(map(r => r === 'admin'));
  }
}