import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { take } from 'rxjs/operators';

import QRCode from 'qrcode';

type UserRole = 'admin' | 'employee' | null;

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.css']
})
export class PerfilComponent implements OnInit {
  private authService = inject(AuthService);
  private db = inject(Firestore);

  cargando = true;
  errorMsg = '';

  uid = '';
  nombre = '';
  email = '';
  role: UserRole = null;

  qrDataUrl = '';

  ngOnInit(): void {
    this.authService.user$.pipe(take(1)).subscribe(async (u) => {
      if (!u) {
        this.errorMsg = 'No hay sesión activa.';
        this.cargando = false;
        return;
      }

      try {
        this.uid = u.uid;
        this.email = u.email ?? '';

        // Perfil desde /users/{uid}
        const ref = doc(this.db, 'users', u.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data: any = snap.data();
          this.nombre = data?.nombre ?? this.nombre;
          this.email = data?.email ?? this.email;
          this.role = (data?.role === 'admin' || data?.role === 'employee') ? data.role : null;
        }

        // QR único por empleado: usamos el UID (estable, único y fácil de resolver)
        this.qrDataUrl = await QRCode.toDataURL(this.uid, {
          errorCorrectionLevel: 'M',
          margin: 2,
          scale: 8
        });
      } catch (e: any) {
        console.error(e);
        this.errorMsg = e?.message ?? 'No se pudo cargar el perfil.';
      } finally {
        this.cargando = false;
      }
    });
  }
}
