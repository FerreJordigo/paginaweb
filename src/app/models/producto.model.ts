export class Producto {
  id?: string;
  nombre?: string;
  descripcion?: string;
  categoria?: string;
  cantidad?: number; // si hoy lo usas como stock, lo dejamos

  unidad?: string;
  proveedor?: string;

  // ===== BODEGA 1 (NARANJA) =====
  b1InicialDia?: number;
  b1CobradosNoEntregados?: number;
  b1SalidaPersonal?: number;
  b1SalidaRepartos?: number;
  b1EntradaBodega?: number;

  // ===== BODEGA 2 (AZUL) =====
  b2Existencia?: number;
  b2Entrada?: number;
  b2Salida?: number;

  // ===== OTROS =====
  inventarioFisicoFerreteria?: number;
}
