import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Producto } from '../models/producto.model';
import {addDoc,collection,collectionData,deleteDoc,doc,Firestore,updateDoc,increment} from '@angular/fire/firestore';
import { first, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProductoService {
  private db: Firestore = inject(Firestore);
  private injector = inject(Injector);

  // IMPORTANTE: tu colección debe llamarse "producto"
  private readonly collectionName = 'producto';

  getProductos() {
    return runInInjectionContext(this.injector, () => {
      const colRef = collection(this.db, this.collectionName);

      return collectionData(colRef, { idField: 'id' }).pipe(
        map((data: any[]) =>
          data.map((d) => ({
            id: d.id,
            nombre: d.nombre ?? '',
            descripcion: d.descripcion ?? '',
            categoria: d.categoria ?? '',
            cantidad: d.cantidad ?? d.stock ?? 0,
            unidad: d.unidad ?? '',
            proveedor: d.proveedor ?? '',

            b1InicialDia: d.b1InicialDia ?? (d.cantidad ?? d.stock ?? 0),
            b1CobradosNoEntregados: d.b1CobradosNoEntregados ?? 0,
            b1SalidaPersonal: d.b1SalidaPersonal ?? 0,
            b1SalidaRepartos: d.b1SalidaRepartos ?? 0,
            b1EntradaBodega: d.b1EntradaBodega ?? 0,

            b2Existencia: d.b2Existencia ?? 0,
            b2Entrada: d.b2Entrada ?? 0,
            b2Salida: d.b2Salida ?? 0,

            inventarioFisicoFerreteria: d.inventarioFisicoFerreteria ?? 0,
          }) as Producto)
        ),
        first()
      );
    });
  }

  async agregarProducto(producto: Producto) {
    const colRef = collection(this.db, this.collectionName);

    const data = {
      nombre: producto.nombre ?? '',
      descripcion: producto.descripcion ?? '',
      categoria: producto.categoria ?? '',
      cantidad: producto.cantidad ?? 0,
      unidad: producto.unidad ?? '',
      proveedor: producto.proveedor ?? '',

      b1InicialDia: producto.b1InicialDia ?? (producto.cantidad ?? 0),
      b1CobradosNoEntregados: producto.b1CobradosNoEntregados ?? 0,
      b1SalidaPersonal: producto.b1SalidaPersonal ?? 0,
      b1SalidaRepartos: producto.b1SalidaRepartos ?? 0,
      b1EntradaBodega: producto.b1EntradaBodega ?? 0,

      b2Existencia: producto.b2Existencia ?? 0,
      b2Entrada: producto.b2Entrada ?? 0,
      b2Salida: producto.b2Salida ?? 0,

      inventarioFisicoFerreteria: producto.inventarioFisicoFerreteria ?? 0,
    };

    const docRef = await addDoc(colRef, data);
    return { id: docRef.id, ...data };
  }

  async modificarProducto(producto: Producto) {
    const id = producto.id ?? '';
    if (!id) throw new Error('El producto no tiene un ID válido');

    const docRef = doc(this.db, this.collectionName, id);

    return updateDoc(docRef, {
      nombre: producto.nombre ?? '',
      descripcion: producto.descripcion ?? '',
      categoria: producto.categoria ?? '',
      cantidad: producto.cantidad ?? 0,
      unidad: producto.unidad ?? '',
      proveedor: producto.proveedor ?? '',

      b1InicialDia: producto.b1InicialDia ?? (producto.cantidad ?? 0),
      b1CobradosNoEntregados: producto.b1CobradosNoEntregados ?? 0,
      b1SalidaPersonal: producto.b1SalidaPersonal ?? 0,
      b1SalidaRepartos: producto.b1SalidaRepartos ?? 0,
      b1EntradaBodega: producto.b1EntradaBodega ?? 0,

      b2Existencia: producto.b2Existencia ?? 0,
      b2Entrada: producto.b2Entrada ?? 0,
      b2Salida: producto.b2Salida ?? 0,

      inventarioFisicoFerreteria: producto.inventarioFisicoFerreteria ?? 0,
    });
  }

  async eliminarProducto(producto: Producto) {
    const id = producto.id ?? '';
    if (!id) throw new Error('El producto no tiene un ID válido');

    const docRef = doc(this.db, this.collectionName, id);
    return deleteDoc(docRef);
  }

  actualizarCantidad(productoId: string, cantidad: number) {
    const docRef = doc(this.db, this.collectionName, productoId);
    return updateDoc(docRef, { cantidad: increment(-cantidad) });
  }

  agregarCantidad(productoId: string, cantidad: number) {
    const docRef = doc(this.db, this.collectionName, productoId);
    return updateDoc(docRef, { cantidad: increment(cantidad) });
  }
}
