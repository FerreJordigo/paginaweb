import { Component, OnDestroy, OnInit, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';

import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';

import { Firestore, doc, getDoc } from '@angular/fire/firestore';

import { EmpleadoService } from '../../services/empleado.service';
import { Empleado } from '../../models/empleado.model';
import { RegistroEmpleado } from '../../models/registro_empleado.model';
import { RoleService } from '../../services/role.service';

type Step = 'entrada' | 'inicio' | 'fin' | 'salida' | 'done';

@Component({
  selector: 'app-asistencia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './asistencia.component.html',
  styleUrls: ['./asistencia.component.css']
})
export class AsistenciaComponent implements OnInit, OnDestroy {
  private empleadoService = inject(EmpleadoService);
  private roleService = inject(RoleService);
  private db = inject(Firestore);
  private injector = inject(EnvironmentInjector);

  hoyKey = this.toFechaKey(new Date());
  fechaKey = this.hoyKey;

  role: 'admin' | 'employee' | null = null;
  empleados: Empleado[] = [];
  registros: RegistroEmpleado[] = [];

  cargando = false;
  errorMsg = '';

  qrEmpleado: { uid: string; nombre: string } | null = null;
  registroActual: RegistroEmpleado | null = null;
  marcacionModalOpen = false;
  marcacionError = '';

  scannerOpen = false;
  scanning = false;
  scanError = '';
  private reader: BrowserMultiFormatReader | null = null;
  private controls: IScannerControls | null = null;

  async ngOnInit(): Promise<void> {
    this.role = await firstValueFrom(this.roleService.role$.pipe(take(1)));

    try {
      this.empleados = await firstValueFrom(this.empleadoService.getEmpleados());
      this.empleados = [...(this.empleados ?? [])].sort((a, b) =>
        (a.nombre ?? '').localeCompare(b.nombre ?? '')
      );
    } catch {
      this.empleados = [];
    }

    await this.cargarRegistrosDia();
  }

  ngOnDestroy(): void {
    this.stopScan();
  }

  async onChangeFecha(): Promise<void> {
    this.resetSeleccion();
    await this.cargarRegistrosDia();
  }

  async cargarRegistrosDia(): Promise<void> {
    this.errorMsg = '';
    this.cargando = true;
    try {
      const data = await firstValueFrom(this.empleadoService.getRegistrosByFecha(this.fechaKey));
      const list = [...(data ?? [])];

      const byEmp = new Map<string, RegistroEmpleado>();
      for (const r of list) {
        const key = (r as any)?.empleadoId ?? '';
        if (!key) continue;
        const prev = byEmp.get(key);
        if (!prev) {
          byEmp.set(key, r);
          continue;
        }
        const tPrev = new Date((prev as any)?.updatedAt ?? (prev as any)?.creadoEn ?? 0).getTime();
        const tNow = new Date((r as any)?.updatedAt ?? (r as any)?.creadoEn ?? 0).getTime();
        if (tNow >= tPrev) byEmp.set(key, r);
      }

      this.registros = Array.from(byEmp.values()).sort((a, b) =>
        (a.empleadoNombre ?? '').localeCompare(b.empleadoNombre ?? '')
      );
    } catch (e: any) {
      console.error(e);
      this.registros = [];
      this.errorMsg = e?.message ?? 'No se pudieron cargar los registros del día.';
    } finally {
      this.cargando = false;
    }
  }

  async openScan(): Promise<void> {
    this.scanError = '';
    this.scannerOpen = true;
    await this.startScan();
  }

  closeScan(): void {
    this.scannerOpen = false;
    this.stopScan();
  }

  async startScan(): Promise<void> {
    try {
      this.scanError = '';
      this.scanning = true;
      this.reader = this.reader ?? new BrowserMultiFormatReader();

      this.controls = await this.reader.decodeFromVideoDevice(
        undefined,
        'qrVideo',
        async (result, _err, controls) => {
          if (!result) return;
          const uid = result.getText()?.trim();
          if (!uid) return;
          controls.stop();
          this.scanning = false;
          await this.onQrDecoded(uid);
        }
      );
    } catch (e) {
      console.error(e);
      this.scanError = 'No se pudo acceder a la cámara. Revisa permisos o usa HTTPS.';
      this.scanning = false;
    }
  }

  stopScan(): void {
    try { this.controls?.stop(); } catch {}
    this.controls = null;
    this.scanning = false;
  }

  private async onQrDecoded(uid: string): Promise<void> {
    this.errorMsg = '';
    this.scanError = '';

    let nombre = '';
    try {
      // Envolvemos la llamada a la base de datos
      const snap = await runInInjectionContext(this.injector, () => getDoc(doc(this.db, 'users', uid)));
      if (!snap.exists()) {
        this.scanError = 'QR válido, pero el usuario no está habilitado (no existe en users).';
        return;
      }
      const data: any = snap.data();
      nombre = (data?.nombre ?? '').trim();
    } catch (e) {
      console.error(e);
    }

    if (!nombre) {
      nombre = this.empleados.find(e => e.id === uid)?.nombre ?? '';
    }
    if (!nombre) nombre = 'Empleado';

    this.qrEmpleado = { uid, nombre };
    this.scannerOpen = false;

    await this.ensureRegistroDia(uid, nombre);
    this.openMarcacionModal();
  }

  openMarcacionModal(): void {
    if (!this.qrEmpleado) return;
    this.marcacionError = '';
    this.marcacionModalOpen = true;
  }

  closeMarcacionModal(): void {
    this.marcacionModalOpen = false;
  }

  resetSeleccion(): void {
    this.qrEmpleado = null;
    this.registroActual = null;
    this.marcacionModalOpen = false;
    this.marcacionError = '';
    this.scanError = '';
    this.errorMsg = '';
  }

  get nextStep(): Step {
    const r: any = this.registroActual;
    if (!r?.entradaLaboral) return 'entrada';
    if (!r?.inicioComida) return 'inicio';
    if (!r?.finComida) return 'fin';
    if (!r?.salidaLaboral) return 'salida';
    return 'done';
  }

  async marcar(step: Exclude<Step, 'done'>): Promise<void> {
    this.marcacionError = '';
    this.errorMsg = '';

    if (!this.qrEmpleado) {
      this.marcacionError = 'Escanea un QR primero.';
      return;
    }

    if (this.nextStep !== step) {
      this.marcacionError = `Acción inválida. Primero debes registrar: ${this.labelStep(this.nextStep)}.`;
      return;
    }

    const uid = this.qrEmpleado.uid;
    const id = this.registroDocId(this.fechaKey, uid);
    const nowISO = new Date().toISOString();

    const patch: any = {
      empleadoId: uid,
      empleadoNombre: this.qrEmpleado.nombre,
      fechaKey: this.fechaKey,
      updatedAt: nowISO
    };

    if (step === 'entrada') patch.entradaLaboral = nowISO;
    if (step === 'inicio') patch.inicioComida = nowISO;
    if (step === 'fin') patch.finComida = nowISO;
    if (step === 'salida') patch.salidaLaboral = nowISO;

    try {
      this.cargando = true;
      await this.empleadoService.upsertRegistroById(id, patch);
      await this.ensureRegistroDia(uid, this.qrEmpleado.nombre);
      await this.cargarRegistrosDia();
    } catch (e: any) {
      console.error(e);
      this.marcacionError = e?.message ?? 'No se pudo guardar la marcación.';
    } finally {
      this.cargando = false;
    }
  }

  private async ensureRegistroDia(uid: string, nombre: string): Promise<void> {
    const id = this.registroDocId(this.fechaKey, uid);
    const ref = doc(this.db, 'registroempleado', id);
    
    // Envolvemos las llamadas a la base de datos
    const snap = await runInInjectionContext(this.injector, () => getDoc(ref));
    
    if (!snap.exists()) {
      const nowISO = new Date().toISOString();
      await this.empleadoService.upsertRegistroById(id, {
        empleadoId: uid,
        empleadoNombre: nombre,
        fechaKey: this.fechaKey,
        creadoEn: nowISO,
        updatedAt: nowISO,
        entradaLaboral: null as any,
        inicioComida: null as any,
        finComida: null as any,
        salidaLaboral: null as any
      } as any);
    }
    const snap2 = await runInInjectionContext(this.injector, () => getDoc(ref));
    this.registroActual = (snap2.data() as any) ?? null;
  }

  private registroDocId(fechaKey: string, uid: string): string {
    return `${fechaKey}_${uid}`;
  }

  private labelStep(step: Step): string {
    if (step === 'entrada') return 'Entrada';
    if (step === 'inicio') return 'Inicio comida';
    if (step === 'fin') return 'Fin comida';
    if (step === 'salida') return 'Salida';
    return 'Completo';
  }

  toFechaKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  formatHora(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}