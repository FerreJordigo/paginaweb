import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { firstValueFrom, debounceTime, distinctUntilChanged } from 'rxjs';

import { ProductoService } from '../../services/producto.service';
import { RoleService } from '../../services/role.service';
import { Producto } from '../../models/producto.model';

@Component({
  selector: 'app-producto',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './producto.component.html',
  styleUrls: ['./producto.component.css']
})
export class ProductoComponent implements OnInit {
  private productoService = inject(ProductoService);
  private roleService = inject(RoleService);
  private fb = inject(FormBuilder);

  productos: Producto[] = [];
  
  producto: Producto = {
    nombre: '',
    categoria: '',
    proveedor: '',
    ubicacion: '',
    activo: true,
    fechaRegistro: new Date()
  };
  
  tablaForm: FormGroup;
  esAdmin: boolean = false;
  userRole: string = '';
  
  // Notificación Toast
  mostrarToast = false;
  mensajeToast = '';

  // Propiedades para MODAL
  modalAbierto = false;
  nuevoProducto: any = {
    nombre: '',
    cantidad: 0,
    precio: 0,
    categoria: 'Herramientas',
    proveedor: '',
    ubicacion: 'Bodega 1'
  };
  
  categorias: string[] = [
    'Herramientas',
    'Materiales de Construcción',
    'Electricidad',
    'Plomería',
    'Pinturas',
    'Ferretería General',
    'Seguridad',
    'Jardinería'
  ];

  // Columnas que puede editar EMPLOYEE
  columnasEmployee: string[] = [
    'b1SalidaPersonal',      // SALIDA (VENTA ENTREGADA POR EL PERSONAL)
    'b1SalidaRepartos',      // SALIDA (VENTA EN REPARTOS)
    'b1EntradaBodega',       // ENTRADA A BODEGA
    'b2Entrada',             // ENTRADA DE MATERIAL A BODEGA 2
    'b2Salida'               // SALIDA DE BODEGA 2
  ];

  constructor() {
    this.tablaForm = this.fb.group({
      filas: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.roleService.isAdmin$().subscribe(isAdmin => {
      this.esAdmin = isAdmin;
      this.userRole = isAdmin ? 'admin' : 'employee';
      this.cargarProductos();
    });
  }

  async cargarProductos(): Promise<void> {
    try {
      const data = await firstValueFrom(this.productoService.getProductos());
      this.productos = data ?? [];
      this.inicializarTabla(this.productos);
      if (this.esAdmin) {
        this.lanzarToast('Productos cargados correctamente');
      }
    } catch (error) {
      console.error('Error cargando productos:', error);
      this.lanzarToast('Error al cargar productos');
    }
  }

  // Método para determinar si un campo es editable según el rol
  esCampoEditable(nombreCampo: string): boolean {
    if (this.esAdmin) {
      return true; // Admin puede editar todo
    } else {
      // Employee solo puede editar las columnas permitidas
      return this.columnasEmployee.includes(nombreCampo);
    }
  }

  inicializarTabla(productos: Producto[]) {
    this.filas.clear();
    productos.forEach(p => {
      const fila = this.fb.group({
        id: [p.id],
        nombre: [p.nombre, Validators.required],
        b1InicialDia: [{ value: Math.floor(p.b1InicialDia || 0), disabled: !this.esCampoEditable('b1InicialDia') }, [Validators.min(0)]],
        b1CobradosNoEntregados: [{ value: Math.floor(p.b1CobradosNoEntregados || 0), disabled: !this.esCampoEditable('b1CobradosNoEntregados') }, [Validators.min(0)]],
        b1SalidaPersonal: [{ value: Math.floor(p.b1SalidaPersonal || 0), disabled: !this.esCampoEditable('b1SalidaPersonal') }, [Validators.min(0)]],
        b1SalidaRepartos: [{ value: Math.floor(p.b1SalidaRepartos || 0), disabled: !this.esCampoEditable('b1SalidaRepartos') }, [Validators.min(0)]],
        b1EntradaBodega: [{ value: Math.floor(p.b1EntradaBodega || 0), disabled: !this.esCampoEditable('b1EntradaBodega') }, [Validators.min(0)]],
        b2Existencia: [{ value: Math.floor(p.b2Existencia || 0), disabled: !this.esCampoEditable('b2Existencia') }, [Validators.min(0)]],
        b2Entrada: [{ value: Math.floor(p.b2Entrada || 0), disabled: !this.esCampoEditable('b2Entrada') }, [Validators.min(0)]],
        b2Salida: [{ value: Math.floor(p.b2Salida || 0), disabled: !this.esCampoEditable('b2Salida') }, [Validators.min(0)]],
        inventarioFisicoFerreteria: [{ value: Math.floor(p.inventarioFisicoFerreteria || 0), disabled: !this.esCampoEditable('inventarioFisicoFerreteria') }, [Validators.min(0)]]
      });

      // Solo admin tiene auto-guardado
      if (this.esAdmin) {
        fila.valueChanges.pipe(
          debounceTime(1500),
          distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
        ).subscribe(valores => this.autoGuardar(valores));

        // Suscripción para forzar enteros en tiempo real (solo admin)
        Object.keys(fila.controls).forEach(key => {
          if (key !== 'id' && key !== 'nombre') {
            fila.get(key)?.valueChanges.subscribe(value => {
              const entero = Math.floor(Number(value) || 0);
              if (Number(value) !== entero) {
                fila.get(key)?.setValue(entero, { emitEvent: false });
              }
            });
          }
        });
      } else {
        // Para employee: forzar enteros pero sin auto-guardado
        Object.keys(fila.controls).forEach(key => {
          if (key !== 'id' && key !== 'nombre' && this.columnasEmployee.includes(key)) {
            fila.get(key)?.valueChanges.subscribe(value => {
              const entero = Math.floor(Number(value) || 0);
              if (Number(value) !== entero) {
                fila.get(key)?.setValue(entero, { emitEvent: false });
              }
            });
          }
        });
      }

      this.filas.push(fila);
    });
  }

  async autoGuardar(datosFila: any) {
    if (!this.esAdmin) return;
    try {
      const original = this.productos.find(p => p.id === datosFila.id);
      if (original) {
        // Forzar valores enteros antes de guardar
        const datosEnteros = {
          ...datosFila,
          b1InicialDia: Math.floor(Number(datosFila.b1InicialDia) || 0),
          b1CobradosNoEntregados: Math.floor(Number(datosFila.b1CobradosNoEntregados) || 0),
          b1SalidaPersonal: Math.floor(Number(datosFila.b1SalidaPersonal) || 0),
          b1SalidaRepartos: Math.floor(Number(datosFila.b1SalidaRepartos) || 0),
          b1EntradaBodega: Math.floor(Number(datosFila.b1EntradaBodega) || 0),
          b2Existencia: Math.floor(Number(datosFila.b2Existencia) || 0),
          b2Entrada: Math.floor(Number(datosFila.b2Entrada) || 0),
          b2Salida: Math.floor(Number(datosFila.b2Salida) || 0),
          inventarioFisicoFerreteria: Math.floor(Number(datosFila.inventarioFisicoFerreteria) || 0)
        };
        
        const actualizado = { ...original, ...datosEnteros };
        await this.productoService.modificarProducto(actualizado);
        const index = this.productos.findIndex(p => p.id === datosFila.id);
        if (index !== -1) {
          this.productos[index] = actualizado;
        }
        this.lanzarToast(`✓ Guardado: ${datosFila.nombre}`);
      }
    } catch (error) {
      console.error('Error al guardar:', error);
      this.lanzarToast('Error al guardar cambios');
    }
  }

  // Método para guardar cambios de employee (se llamará desde el HTML)
  async guardarCambiosEmployee() {
    if (this.esAdmin) return;
    
    try {
      // Recorrer todas las filas y guardar solo las columnas permitidas
      for (let i = 0; i < this.filas.length; i++) {
        const fila = this.filas.at(i);
        const valores = fila.value;
        const original = this.productos[i];
        
        if (original) {
          // Crear objeto solo con las columnas que employee puede editar
          const cambios: any = { id: original.id };
          this.columnasEmployee.forEach(col => {
            if (valores[col] !== undefined) {
              cambios[col] = Math.floor(Number(valores[col]) || 0);
            }
          });
          
          const actualizado = { ...original, ...cambios };
          await this.productoService.modificarProducto(actualizado);
          this.productos[i] = actualizado;
        }
      }
      this.lanzarToast('✓ Cambios guardados correctamente');
    } catch (error) {
      console.error('Error al guardar:', error);
      this.lanzarToast('Error al guardar cambios');
    }
  }

  // ========== MÉTODOS DEL MODAL ==========
  abrirModalNuevoProducto(): void {
    if (!this.esAdmin) return; // Solo admin puede agregar productos
    this.nuevoProducto = {
      nombre: '',
      cantidad: 0,
      precio: 0,
      categoria: 'Herramientas',
      proveedor: '',
      ubicacion: 'Bodega 1'
    };
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
  }

  async guardarNuevoProducto(): Promise<void> {
    if (!this.esAdmin) return; // Solo admin puede guardar productos
    
    if (!this.nuevoProducto.nombre?.trim()) {
      this.lanzarToast('El nombre del producto es obligatorio');
      return;
    }

    const cantidadEntera = Math.floor(Number(this.nuevoProducto.cantidad) || 0);
    const precioEntero = Math.floor(Number(this.nuevoProducto.precio) || 0);

    if (cantidadEntera < 0) {
      this.lanzarToast('La cantidad no puede ser negativa');
      return;
    }

    try {
      const nuevoProducto: Producto = {
        id: Date.now().toString(),
        nombre: this.nuevoProducto.nombre,
        categoria: this.nuevoProducto.categoria,
        proveedor: this.nuevoProducto.proveedor || 'Sin proveedor',
        ubicacion: this.nuevoProducto.ubicacion || 'Bodega 1',
        codigo: `PROD-${Date.now()}`,
        descripcion: this.nuevoProducto.nombre,
        cantidad: cantidadEntera,
        unidad: 'Unidad',
        precio: precioEntero,
        stockMinimo: 5,
        stockMaximo: 100,
        
        b1InicialDia: cantidadEntera,
        b1CobradosNoEntregados: 0,
        b1SalidaPersonal: 0,
        b1SalidaRepartos: 0,
        b1EntradaBodega: 0,
        b2Existencia: 0,
        b2Entrada: 0,
        b2Salida: 0,
        inventarioFisicoFerreteria: cantidadEntera,
        
        activo: true,
        fechaRegistro: new Date()
      };

      await this.productoService.agregarProducto(nuevoProducto);
      await this.cargarProductos();
      this.cerrarModal();
      this.lanzarToast(`✅ Producto "${this.nuevoProducto.nombre}" agregado`);
    } catch (error) {
      console.error('Error al guardar producto:', error);
      this.lanzarToast('Error al guardar el producto');
    }
  }

  async eliminarDesdeTabla(p: Producto) {
    if (!this.esAdmin) return;
    
    if (confirm(`¿Eliminar definitivamente "${p.nombre}"?`)) {
      try {
        await this.productoService.eliminarProducto(p);
        this.lanzarToast(`🗑️ Producto "${p.nombre}" eliminado`);
        this.cargarProductos();
      } catch (error) {
        console.error('Error al eliminar:', error);
        this.lanzarToast('Error al eliminar producto');
      }
    }
  }

  lanzarToast(mensaje: string) {
    this.mensajeToast = mensaje;
    this.mostrarToast = true;
    setTimeout(() => this.mostrarToast = false, 3000);
  }

  refrescarTabla(): void {
    this.cargarProductos();
  }

  // ========== GETTERS Y CÁLCULOS ==========
  get filas() { 
    return this.tablaForm.get('filas') as FormArray; 
  }

  getSaldoB1(i: number): number {
    const v = this.filas.at(i).value;
    return (Math.floor(Number(v.b1InicialDia) || 0) + Math.floor(Number(v.b1EntradaBodega) || 0)) - 
           (Math.floor(Number(v.b1CobradosNoEntregados) || 0) + 
            Math.floor(Number(v.b1SalidaPersonal) || 0) + 
            Math.floor(Number(v.b1SalidaRepartos) || 0));
  }

  getSaldoB2(i: number): number {
    const v = this.filas.at(i).value;
    return (Math.floor(Number(v.b2Existencia) || 0) + Math.floor(Number(v.b2Entrada) || 0)) - 
            Math.floor(Number(v.b2Salida) || 0);
  }

  getSaldoTotal(i: number): number {
    return this.getSaldoB1(i) + this.getSaldoB2(i) + 
           Math.floor(Number(this.filas.at(i).value.inventarioFisicoFerreteria) || 0);
  }

  // ========== MÉTODO CORREGIDO (Línea 357) ==========
  moverAbajo(event: any, index: number, controlName: string) {
    if ((event.key === 'Enter' || event.key === 'ArrowDown') && this.esCampoEditable(controlName)) {
      event.preventDefault();
      setTimeout(() => {
        const elemento = document.querySelector(
          `tr[data-index="${index + 1}"] input[formControlName="${controlName}"]`
        ) as HTMLInputElement; // ✅ Type assertion correcta
        
        if (elemento && !elemento.disabled) { // ✅ Ahora TypeScript sabe que tiene disabled
          elemento.focus();
        }
      }, 50);
    }
  }
}