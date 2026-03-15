import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { EmpleadoService } from '../../services/empleado.service';
import { Empleado } from '../../models/empleado.model';
import { RegistroEmpleado } from '../../models/registro_empleado.model';

type TabEmpleado = 'empleados' | 'marcaciones';
type ModalMode = 'add' | 'edit';

@Component({
  selector: 'app-empleado',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './empleado.component.html',
  styleUrl: './empleado.component.css'
})
export class EmpleadoComponent implements OnInit {
  tab: TabEmpleado = 'empleados';

  empleados: Empleado[] = [];
  registros: RegistroEmpleado[] = [];

  // Filtros historial
  fecha = this.hoyFechaKey();
  empleadoIdSeleccionado = ''; // '' = Todos

  loading = false;
  errorMsg = '';

  // Modal
  modalOpen = false;
  modalMode: ModalMode = 'add';

  modalNombre = '';
  modalEmail = '';
  modalPasswordTemp = '';
  modalRole: 'admin' | 'employee' = 'employee';

  modalEditId = '';

  constructor(private empleadoService: EmpleadoService) {}

  async ngOnInit(): Promise<void> {
    await this.cargarEmpleados();
    await this.cargarRegistros();
  }

  setTab(t: TabEmpleado): void {
    this.tab = t;
    if (t === 'marcaciones') {
      this.cargarRegistros();
    }
  }

  // ===== CARGAS =====
  async cargarEmpleados(): Promise<void> {
    this.errorMsg = '';
    try {
      const data = await firstValueFrom(this.empleadoService.getEmpleados());
      this.empleados = [...(data ?? [])].sort((a, b) =>
        (a.nombre ?? '').localeCompare(b.nombre ?? '')
      );

      if (this.empleadoIdSeleccionado) {
        const existe = this.empleados.some(e => e.id === this.empleadoIdSeleccionado);
        if (!existe) this.empleadoIdSeleccionado = '';
      }
    } catch (e) {
      console.error(e);
      this.empleados = [];
      this.errorMsg = 'No se pudieron cargar los empleados.';
    }
  }

  async cargarRegistros(): Promise<void> {
    this.errorMsg = '';
    this.loading = true;

    try {
      const data = await firstValueFrom(this.empleadoService.getRegistrosByFecha(this.fecha));
      this.registros = [...(data ?? [])].sort((a, b) =>
        (a.empleadoNombre ?? '').localeCompare(b.empleadoNombre ?? '')
      );
    } catch (e) {
      console.error(e);
      this.registros = [];
      this.errorMsg = 'No se pudieron cargar los registros del día.';
    } finally {
      this.loading = false;
    }
  }

  async onFechaChange(): Promise<void> {
    await this.cargarRegistros();
  }

  // ===== HISTORIAL (FILTRADO) =====
  get registrosFiltrados(): RegistroEmpleado[] {
    const id = this.empleadoIdSeleccionado;
    if (!id) return this.registros ?? [];
    return (this.registros ?? []).filter(r => r.empleadoId === id);
  }

  // ===== MODAL =====
  openAddModal(): void {
    this.modalMode = 'add';
    this.modalNombre = '';
    this.modalEmail = '';
    this.modalPasswordTemp = '';
    this.modalRole = 'employee';
    this.modalEditId = '';
    this.modalOpen = true;
  }

  openEditModal(e: Empleado): void {
    this.modalMode = 'edit';
    this.modalNombre = (e.nombre ?? '').trim();
    this.modalEmail = (e.email ?? '').trim();
    this.modalRole = (e.role === 'admin') ? 'admin' : 'employee';
    this.modalPasswordTemp = '';
    this.modalEditId = e.id ?? '';
    this.modalOpen = true;
  }

  closeModal(): void {
    this.modalOpen = false;
  }

  async saveModal(): Promise<void> {
    const nombre = this.modalNombre.trim();
    if (!nombre) {
      alert('Ingrese el nombre del empleado.');
      return;
    }

    try {
      this.loading = true;

      if (this.modalMode === 'add') {
        const email = this.modalEmail.trim().toLowerCase();
        const pass = this.modalPasswordTemp;

        if (!email) {
          alert('Ingrese el correo del empleado.');
          return;
        }
        if (!pass || pass.length < 6) {
          alert('Ingrese una contraseña temporal (mínimo 6 caracteres).');
          return;
        }

        await this.empleadoService.crearEmpleadoConCuenta({
          nombre,
          email,
          passwordTemporal: pass,
          role: this.modalRole
        });
      } else {
        if (!this.modalEditId) {
          alert('No se encontró el ID del empleado.');
          return;
        }
        await this.empleadoService.actualizarEmpleado(this.modalEditId, nombre);
      }

      this.closeModal();
      await this.cargarEmpleados();
    } catch (e: any) {
      console.error(e);
      const code = e?.code ?? '';
      const msg = e?.message ?? e;
      alert(`Error ${code ? `(${code})` : ''}: ${msg}`);
    } finally {
      this.loading = false;
    }
  }

  // ===== ELIMINAR =====
  async confirmDelete(e: Empleado): Promise<void> {
    const id = e.id ?? '';
    const nombre = e.nombre ?? '';

    if (!id) return;

    const ok = confirm(`¿Eliminar a "${nombre}"? También se borrarán TODOS sus registros.`);
    if (!ok) return;

    try {
      this.loading = true;

      await this.empleadoService.eliminarEmpleadoConRegistros(id);

      if (this.empleadoIdSeleccionado === id) {
        this.empleadoIdSeleccionado = '';
      }

      await this.cargarEmpleados();
      await this.cargarRegistros();
    } catch (e: any) {
      console.error(e);
      alert(`Error: ${e?.message ?? e}`);
    } finally {
      this.loading = false;
    }
  }

  // ===== HELPERS UI =====
  initials(nombre?: string): string {
    const n = (nombre ?? '').trim();
    if (!n) return '—';
    const parts = n.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? '';
    const b = parts[1]?.[0] ?? '';
    return (a + b).toUpperCase();
  }

  formatHora(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private hoyFechaKey(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
