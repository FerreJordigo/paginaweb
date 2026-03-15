import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray } from '@angular/forms';
import { firstValueFrom, debounceTime, distinctUntilChanged } from 'rxjs';

import { ProductoService } from '../../services/producto.service';
import { Producto } from '../../models/producto.model';

@Component({
  selector: 'app-producto',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './producto.component.html',
  styleUrls: ['./producto.component.css']
})
export class ProductoComponent implements OnInit {
  productos: Producto[] = [];
  producto: Producto = new Producto();
  
  // Formulario Reactivo para la tabla
  tablaForm: FormGroup;

  modalOpen = false;
  modalTitle = 'Nuevo producto';
  isEditMode = false;

  constructor(
    private productoService: ProductoService,
    private fb: FormBuilder
  ) {
    this.tablaForm = this.fb.group({
      filas: this.fb.array([])
    });
  }

  get filas() {
    return this.tablaForm.get('filas') as FormArray;
  }

  ngOnInit(): void {
    this.getProductos();
  }

  async getProductos(): Promise<void> {
    try {
      const data = await firstValueFrom(this.productoService.getProductos());
      this.productos = data ?? [];
      this.inicializarTabla(this.productos);
    } catch (error) {
      console.error('Error leyendo productos:', error);
    }
  }

  inicializarTabla(productos: Producto[]) {
    this.filas.clear();
    productos.forEach(p => {
      const fila = this.fb.group({
        id: [p.id],
        nombre: [p.nombre],
        b1InicialDia: [p.b1InicialDia || 0],
        b1CobradosNoEntregados: [p.b1CobradosNoEntregados || 0],
        b1SalidaPersonal: [p.b1SalidaPersonal || 0],
        b1SalidaRepartos: [p.b1SalidaRepartos || 0],
        b1EntradaBodega: [p.b1EntradaBodega || 0],
        b2Existencia: [p.b2Existencia || 0],
        b2Entrada: [p.b2Entrada || 0],
        b2Salida: [p.b2Salida || 0],
        inventarioFisicoFerreteria: [p.inventarioFisicoFerreteria || 0]
      });

      // Auto-guardado al cambiar cualquier celda de la fila (1.5s de delay)
      fila.valueChanges.pipe(
        debounceTime(1500),
        distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
      ).subscribe(valores => this.autoGuardar(valores));

      this.filas.push(fila);
    });
  }

  async autoGuardar(datosFila: any) {
    const original = this.productos.find(p => p.id === datosFila.id);
    if (original) {
      const actualizado = { ...original, ...datosFila };
      try {
        await this.productoService.modificarProducto(actualizado);
        console.log('Fila sincronizada:', datosFila.nombre);
      } catch (error) {
        console.error('Error auto-guardado:', error);
      }
    }
  }

  // --- Navegación tipo Excel (Enter para bajar) ---
  moverAbajo(event: any, index: number, controlName: string) {
    if (event.key === 'Enter') {
      const siguienteFila = index + 1;
      if (siguienteFila < this.filas.length) {
        // Buscamos el input en la siguiente fila con el mismo nombre de control
        setTimeout(() => {
          const selector = `tr[data-index="${siguienteFila}"] input[formControlName="${controlName}"]`;
          const el = document.querySelector(selector) as HTMLElement;
          if (el) el.focus();
        }, 10);
      }
    }
  }

  // --- Cálculos Reactivos ---
  getSaldoB1(i: number): number {
    const v = this.filas.at(i).value;
    return (Number(v.b1InicialDia) + Number(v.b1EntradaBodega)) - 
           (Number(v.b1CobradosNoEntregados) + Number(v.b1SalidaPersonal) + Number(v.b1SalidaRepartos));
  }

  getSaldoB2(i: number): number {
    const v = this.filas.at(i).value;
    return (Number(v.b2Existencia) + Number(v.b2Entrada)) - Number(v.b2Salida);
  }

  getSaldoTotal(i: number): number {
    return this.getSaldoB1(i) + this.getSaldoB2(i) + Number(this.filas.at(i).value.inventarioFisicoFerreteria);
  }

  // --- Gestión de Modales ---
  abrirModalNuevo() {
    this.isEditMode = false;
    this.modalTitle = 'Nuevo producto';
    this.producto = new Producto();
    this.modalOpen = true;
  }

  cerrarModal() { this.modalOpen = false; }

  async guardarDesdeModal() {
    try {
      if (this.isEditMode) {
        await this.productoService.modificarProducto(this.producto);
      } else {
        await this.productoService.agregarProducto(this.producto);
      }
      this.modalOpen = false;
      this.getProductos();
    } catch (error) {
      alert('Error al guardar producto');
    }
  }

  async eliminarDesdeTabla(p: Producto) {
    if (confirm(`¿Eliminar "${p.nombre}"?`)) {
      await this.productoService.eliminarProducto(p);
      this.getProductos();
    }
  }
}