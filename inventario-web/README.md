# Inventario Web

Panel completo para gestionar productos, clientes, pedidos, deudas y flujo de caja.

## Funcionalidades principales

- Productos: crear, editar, actualizar precios y gestionar precios personalizados por comuna.
- Clientes: alta/edición, contacto formateado, búsqueda y resumen de historial.
- Pedidos: crear pedidos con múltiples ítems, editar/cancelar, marcar entregas parciales o completas, registrar ventas en caja al entregar.
- Deudas: crear deudas desde pedidos pendientes, registrar pagos (crea ingreso en cashflow), ver deudores y montos, exportar a Excel.
- Cashflow: registrar ingresos/egresos, eliminar movimientos, ver totales y exportar a Excel.
- Pendientes: panel de pedidos pendientes por cliente, con selección de productos a entregar o pasar a deuda.
- Inventario y métricas: KPIs de inventario, clientes activos, pedidos pendientes; visor de reportes (opcional si está habilitado en servidor).
- Actividad: panel con actividad reciente.
- Exports: exportar cashflow y deudas a Excel (HTML/XLS compatible).
- Arranque rápido: script `start-app.bat` para levantar frontend y backend juntos.

## Cómo ejecutar

1. `npm install` en la raíz y en `server/` si no están las dependencias.
2. Backend: `cd server && npm run dev` (o usa `npm run dev:all` desde la raíz si está definido).
3. Frontend: `npm run dev` en la raíz.
4. Abrir `http://localhost:5173`.

## Estructura

- `src/`: frontend React (Vite).
- `server/`: API Express con almacenamiento en `server/data/db.json`.
- `start-app.bat`: arranca frontend y backend en paralelo y abre el navegador.
