'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Inicializar Supabase Client con las variables de entorno de Vercel
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Home() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clientes' | 'prestamos' | 'pagos'>('dashboard');
  const [loading, setLoading] = useState(true);

  // Estados de datos
  const [clientes, setClientes] = useState<any[]>([]);
  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [quincenas, setQuincenas] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);

  // Formularios
  const [nuevoCliente, setNuevoCliente] = useState({ nombre_completo: '', cedula: '', telefono: '', direccion: '' });
  const [nuevoPrestamo, setNuevoPrestamo] = useState({ cliente_id: '', monto_original: '', tasa_quincenal: '5', esquema_cobro: '5_20', fecha_inicio: '' });
  const [nuevoPago, setNuevoPago] = useState({ prestamo_id: '', monto_total: '', notas: '' });

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setLoading(true);
    if (!supabaseUrl || !supabaseAnonKey) {
      setLoading(false);
      return;
    }

    const { data: dataClientes } = await supabase.from('clientes').select('*').order('creado_en', { ascending: false });
    const { data: dataPrestamos } = await supabase.from('prestamos').select('*, clientes(nombre_completo)').order('creado_en', { ascending: false });
    const { data: dataQuincenas } = await supabase.from('quincenas_interes').select('*');
    const { data: dataPagos } = await supabase.from('pagos').select('*, prestamos(*, clientes(nombre_completo))').order('fecha_pago', { ascending: false });

    if (dataClientes) setClientes(dataClientes);
    if (dataPrestamos) setPrestamos(dataPrestamos);
    if (dataQuincenas) setQuincenas(dataQuincenas);
    if (dataPagos) setPagos(dataPagos);

    setLoading(false);
  }

  // --- ACCIONES DE BASE DE DATOS ---

  async function handleCrearCliente(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoCliente.nombre_completo || !nuevoCliente.telefono) return alert('Nombre y teléfono son obligatorios');

    const { error } = await supabase.from('clientes').insert([nuevoCliente]);
    if (error) alert('Error creando cliente: ' + error.message);
    else {
      setNuevoCliente({ nombre_completo: '', cedula: '', telefono: '', direccion: '' });
      cargarDatos();
      alert('Cliente registrado con éxito');
    }
  }

  async function handleCrearPrestamo(e: React.FormEvent) {
    e.preventDefault();
    const monto = parseFloat(nuevoPrestamo.monto_original);
    const tasa = parseFloat(nuevoPrestamo.tasa_quincenal);

    if (!nuevoPrestamo.cliente_id || !monto || !tasa || !nuevoPrestamo.fecha_inicio) {
      return alert('Completa todos los campos obligatorios del préstamo');
    }

    const { data: prestamoCreado, error } = await supabase.from('prestamos').insert([{
      cliente_id: nuevoPrestamo.cliente_id,
      monto_original: monto,
      capital_pendiente: monto,
      tasa_quincenal: tasa,
      esquema_cobro: nuevoPrestamo.esquema_cobro,
      fecha_inicio: nuevoPrestamo.fecha_inicio,
      estado: 'activo'
    }]).select().single();

    if (error) {
      alert('Error creando préstamo: ' + error.message);
    } else if (prestamoCreado) {
      // Generar primera quincena de interés simple
      const montoInteres = (monto * tasa) / 100;
      const fechaCobro = new Date(nuevoPrestamo.fecha_inicio);
      fechaCobro.setDate(fechaCobro.getDate() + 15);

      const fechaGracia = new Date(fechaCobro);
      fechaGracia.setDate(fechaGracia.getDate() + 10);

      await supabase.from('quincenas_interes').insert([{
        prestamo_id: prestamoCreado.id,
        fecha_cobro: fechaCobro.toISOString().split('T')[0],
        fecha_limite_gracia: fechaGracia.toISOString().split('T')[0],
        monto_interes: montoInteres,
        interes_pendiente: montoInteres,
        estado: 'pendiente'
      }]);

      setNuevoPrestamo({ cliente_id: '', monto_original: '', tasa_quincenal: '5', esquema_cobro: '5_20', fecha_inicio: '' });
      cargarDatos();
      alert('Préstamo registrado y quincena calculada');
    }
  }

  async function handleRegistrarPago(e: React.FormEvent) {
    e.preventDefault();
    const prestamo = prestamos.find(p => p.id === nuevoPago.prestamo_id);
    const montoAbonado = parseFloat(nuevoPago.monto_total);

    if (!prestamo || !montoAbonado) return alert('Selecciona préstamo e ingresa el monto');

    // Buscar intereses pendientes del préstamo
    const quincenasPendientes = quincenas.filter(q => q.prestamo_id === prestamo.id && q.interes_pendiente > 0);
    const totalInteresPendiente = quincenasPendientes.reduce((acc, curr) => acc + Number(curr.interes_pendiente), 0);

    // PRELACIÓN DE PAGO: Primero interés, sobrante a capital
    const aplicadoInteres = Math.min(montoAbonado, totalInteresPendiente);
    const aplicadoCapital = Math.max(0, montoAbonado - aplicadoInteres);

    // Registrar en tabla de pagos
    const { error: errPago } = await supabase.from('pagos').insert([{
      prestamo_id: prestamo.id,
      monto_total: montoAbonado,
      aplicado_interes: aplicadoInteres,
      aplicado_capital: aplicadoCapital,
      notas: nuevoPago.notas
    }]);

    if (errPago) return alert('Error al registrar pago: ' + errPago.message);

    // Actualizar capital pendiente del préstamo
    const nuevoCapitalPendiente = Math.max(0, Number(prestamo.capital_pendiente) - aplicadoCapital);
    const nuevoEstadoPrestamo = nuevoCapitalPendiente === 0 ? 'cancelado' : 'activo';

    await supabase.from('prestamos').update({
      capital_pendiente: nuevoCapitalPendiente,
      estado: nuevoEstadoPrestamo
    }).eq('id', prestamo.id);

    // Descontar intereses pendientes de las quincenas
    let remanenteInteresPago = aplicadoInteres;
    for (const q of quincenasPendientes) {
      if (remanenteInteresPago <= 0) break;
      const aDescontar = Math.min(remanenteInteresPago, Number(q.interes_pendiente));
      const nuevoInteresPend = Number(q.interes_pendiente) - aDescontar;

      await supabase.from('quincenas_interes').update({
        interes_pendiente: nuevoInteresPend,
        estado: nuevoInteresPend === 0 ? 'pagado' : 'pendiente'
      }).eq('id', q.id);

      remanenteInteresPago -= aDescontar;
    }

    setNuevoPago({ prestamo_id: '', monto_total: '', notas: '' });
    cargarDatos();
    alert('Abono registrado con éxito');
  }

  // --- CÁLCULOS DE MÉTRICAS DEL DASHBOARD ---
  const totalCapitalColocado = prestamos.reduce((acc, curr) => acc + Number(curr.monto_original || 0), 0);
  const totalCapitalPendiente = prestamos.reduce((acc, curr) => acc + Number(curr.capital_pendiente || 0), 0);
  const totalInteresCobrado = pagos.reduce((acc, curr) => acc + Number(curr.aplicado_interes || 0), 0);
  const totalInteresPendiente = quincenas.reduce((acc, curr) => acc + Number(curr.interes_pendiente || 0), 0);

  const hoyStr = new Date().toISOString().split('T')[0];
  const totalInteresAtrasado = quincenas
    .filter(q => q.interes_pendiente > 0 && q.fecha_limite_gracia < hoyStr)
    .reduce((acc, curr) => acc + Number(curr.interes_pendiente || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      {/* HEADER DE NAVEGACIÓN */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl font-black tracking-tight text-sky-400">CRM PRÉSTAMOS</h1>
          <nav className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1 text-sm font-semibold">
            <button 
              onClick={() => setActiveTab('dashboard')} 
              className={`px-4 py-2 rounded-lg transition ${activeTab === 'dashboard' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('clientes')} 
              className={`px-4 py-2 rounded-lg transition ${activeTab === 'clientes' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Clientes
            </button>
            <button 
              onClick={() => setActiveTab('prestamos')} 
              className={`px-4 py-2 rounded-lg transition ${activeTab === 'prestamos' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Préstamos
            </button>
            <button 
              onClick={() => setActiveTab('pagos')} 
              className={`px-4 py-2 rounded-lg transition ${activeTab === 'pagos' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Cobros / Pagos
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8 space-y-8">
        {loading && <p className="text-center text-slate-400 py-12">Cargando datos de Supabase...</p>}

        {!loading && activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* METRICAS PRINCIPALES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Capital Colocado</p>
                <p className="text-2xl font-black text-white mt-2">${totalCapitalColocado.toFixed(2)}</p>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Capital Por Recuperar</p>
                <p className="text-2xl font-black text-sky-400 mt-2">${totalCapitalPendiente.toFixed(2)}</p>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Intereses Cobrados</p>
                <p className="text-2xl font-black text-emerald-400 mt-2">${totalInteresCobrado.toFixed(2)}</p>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Interés Pendiente Total</p>
                <p className="text-2xl font-black text-amber-400 mt-2">${totalInteresPendiente.toFixed(2)}</p>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-red-900/50 bg-red-950/10 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-red-400">Atrasado (+10 días gracia)</p>
                <p className="text-2xl font-black text-red-500 mt-2">${totalInteresAtrasado.toFixed(2)}</p>
              </div>
            </div>

            {/* TABLA DE PRÉSTAMOS ACTIVOS */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
              <h2 className="text-xl font-bold text-white">Préstamos Activos</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Monto Orig.</th>
                      <th className="py-3 px-4">Capital Pend.</th>
                      <th className="py-3 px-4">Tasa Quincenal</th>
                      <th className="py-3 px-4">Esquema</th>
                      <th className="py-3 px-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {prestamos.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-bold text-white">{p.clientes?.nombre_completo || 'N/A'}</td>
                        <td className="py-3 px-4">${Number(p.monto_original).toFixed(2)}</td>
                        <td className="py-3 px-4 font-bold text-sky-400">${Number(p.capital_pendiente).toFixed(2)}</td>
                        <td className="py-3 px-4">{p.tasa_quincenal}%</td>
                        <td className="py-3 px-4"><span className="bg-slate-800 px-2 py-1 rounded text-xs font-semibold">{p.esquema_cobro}</span></td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${p.estado === 'activo' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'}`}>
                            {p.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {prestamos.length === 0 && (
                      <tr><td colSpan={6} className="text-center py-6 text-slate-500">No hay préstamos registrados.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA CLIENTES */}
        {!loading && activeTab === 'clientes' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <form onSubmit={handleCrearCliente} className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4 h-fit">
              <h2 className="text-lg font-bold text-white">Registrar Cliente</h2>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Nombre Completo *</label>
                <input 
                  type="text" 
                  value={nuevoCliente.nombre_completo} 
                  onChange={e => setNuevoCliente({...nuevoCliente, nombre_completo: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-sky-500"
                  placeholder="Ej: Juan Pérez"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Cédula</label>
                <input 
                  type="text" 
                  value={nuevoCliente.cedula} 
                  onChange={e => setNuevoCliente({...nuevoCliente, cedula: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-sky-500"
                  placeholder="8-888-8888"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Teléfono *</label>
                <input 
                  type="text" 
                  value={nuevoCliente.telefono} 
                  onChange={e => setNuevoCliente({...nuevoCliente, telefono: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-sky-500"
                  placeholder="6000-0000"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Dirección</label>
                <input 
                  type="text" 
                  value={nuevoCliente.direccion} 
                  onChange={e => setNuevoCliente({...nuevoCliente, direccion: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-sky-500"
                  placeholder="Ciudad de Panamá"
                />
              </div>
              <button type="submit" className="w-full bg-sky-500 hover:bg-sky-400 text-white font-bold py-3 rounded-xl transition">
                Guardar Cliente
              </button>
            </form>

            <div className="lg:col-span-2 bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
              <h2 className="text-lg font-bold text-white">Directorio de Clientes ({clientes.length})</h2>
              <div className="divide-y divide-slate-800">
                {clientes.map(c => (
                  <div key={c.id} className="py-4 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-white">{c.nombre_completo}</p>
                      <p className="text-xs text-slate-400">Cédula: {c.cedula || 'N/A'} | Tel: {c.telefono}</p>
                      {c.direccion && <p className="text-xs text-slate-500 mt-1">{c.direccion}</p>}
                    </div>
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-1 rounded-full font-bold">
                      {c.estado}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA PRÉSTAMOS */}
        {!loading && activeTab === 'prestamos' && (
          <div className="max-w-2xl mx-auto bg-slate-900 p-8 rounded-2xl border border-slate-800 space-y-6">
            <h2 className="text-xl font-bold text-white">Nuevo Préstamo</h2>
            <form onSubmit={handleCrearPrestamo} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Seleccionar Cliente *</label>
                <select 
                  value={nuevoPrestamo.cliente_id} 
                  onChange={e => setNuevoPrestamo({...nuevoPrestamo, cliente_id: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="">-- Selecciona un cliente --</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre_completo} ({c.telefono})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Monto del Préstamo ($) *</label>
                  <input 
                    type="number" 
                    value={nuevoPrestamo.monto_original} 
                    onChange={e => setNuevoPrestamo({...nuevoPrestamo, monto_original: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-sky-500"
                    placeholder="1000.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Tasa Quincenal (%) *</label>
                  <input 
                    type="number" 
                    value={nuevoPrestamo.tasa_quincenal} 
                    onChange={e => setNuevoPrestamo({...nuevoPrestamo, tasa_quincenal: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-sky-500"
                    placeholder="5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Esquema de Cobro *</label>
                  <select 
                    value={nuevoPrestamo.esquema_cobro} 
                    onChange={e => setNuevoPrestamo({...nuevoPrestamo, esquema_cobro: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="5_20">Días 5 y 20</option>
                    <option value="10_25">Días 10 y 25</option>
                    <option value="15_30">Días 15 y 30</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Fecha de Desembolso *</label>
                  <input 
                    type="date" 
                    value={nuevoPrestamo.fecha_inicio} 
                    onChange={e => setNuevoPrestamo({...nuevoPrestamo, fecha_inicio: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <button type="submit" className="w-full bg-sky-500 hover:bg-sky-400 text-white font-bold py-3 rounded-xl transition mt-4">
                Generar Préstamo
              </button>
            </form>
          </div>
        )}

        {/* PESTAÑA PAGOS */}
        {!loading && activeTab === 'pagos' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <form onSubmit={handleRegistrarPago} className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4 h-fit">
              <h2 className="text-lg font-bold text-white">Registrar Abono / Pago</h2>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Seleccionar Préstamo *</label>
                <select 
                  value={nuevoPago.prestamo_id} 
                  onChange={e => setNuevoPago({...nuevoPago, prestamo_id: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="">-- Selecciona un préstamo --</option>
                  {prestamos.filter(p => p.estado === 'activo').map(p => (
                    <option key={p.id} value={p.id}>
                      {p.clientes?.nombre_completo} - Saldo: ${Number(p.capital_pendiente).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Monto Recibido ($) *</label>
                <input 
                  type="number" 
                  value={nuevoPago.monto_total} 
                  onChange={e => setNuevoPago({...nuevoPago, monto_total: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-sky-500"
                  placeholder="100.00"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Notas / Observaciones</label>
                <input 
                  type="text" 
                  value={nuevoPago.notas} 
                  onChange={e => setNuevoPago({...nuevoPago, notas: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-sky-500"
                  placeholder="Efectivo / Yappy / Transferencia"
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs text-slate-400 space-y-1">
                <p className="font-bold text-slate-300">Prelación de pago automática:</p>
                <p>1. Cubre intereses acumulados pendientes.</p>
                <p>2. El excedente se abona directo al capital.</p>
              </div>

              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 rounded-xl transition">
                Procesar Abono
              </button>
            </form>

            <div className="lg:col-span-2 bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
              <h2 className="text-lg font-bold text-white">Historial Reciente de Pagos</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Total Pagado</th>
                      <th className="py-3 px-4">A Interés</th>
                      <th className="py-3 px-4">A Capital</th>
                      <th className="py-3 px-4">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {pagos.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 text-xs text-slate-400">{new Date(p.fecha_pago).toLocaleDateString()}</td>
                        <td className="py-3 px-4 font-bold text-white">{p.prestamos?.clientes?.nombre_completo || 'N/A'}</td>
                        <td className="py-3 px-4 font-bold text-emerald-400">${Number(p.monto_total).toFixed(2)}</td>
                        <td className="py-3 px-4 text-amber-400">${Number(p.aplicado_interes).toFixed(2)}</td>
                        <td className="py-3 px-4 text-sky-400">${Number(p.aplicado_capital).toFixed(2)}</td>
                        <td className="py-3 px-4 text-xs text-slate-400">{p.notas || '-'}</td>
                      </tr>
                    ))}
                    {pagos.length === 0 && (
                      <tr><td colSpan={6} className="text-center py-6 text-slate-500">No hay pagos registrados.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
