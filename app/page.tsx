'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Home() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clientes' | 'prestamos' | 'pagos'>('dashboard');
  const [loading, setLoading] = useState(true);

  // Estados
  const [clientes, setClientes] = useState<any[]>([]);
  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [quincenas, setQuincenas] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);

  // Formularios
  const [nuevoCliente, setNuevoCliente] = useState({ nombre_completo: '', cedula: '', telefono: '', direccion: '' });
  const [nuevoPrestamo, setNuevoPrestamo] = useState({ cliente_id: '', monto_original: '', tasa_quincenal: '5', esquema_cobro: '5_20', fecha_inicio: '' });
  const [nuevoPago, setNuevoPago] = useState({ prestamo_id: '', monto_total: '', metodo_pago: 'Yappy' });

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
    const { data: dataPrestamos } = await supabase.from('prestamos').select('*, clientes(*)').order('creado_en', { ascending: false });
    const { data: dataQuincenas } = await supabase.from('quincenas_interes').select('*');
    const { data: dataPagos } = await supabase.from('pagos').select('*, prestamos(*, clientes(*))').order('fecha_pago', { ascending: false });

    if (dataClientes) setClientes(dataClientes);
    if (dataPrestamos) {
      setPrestamos(dataPrestamos);
      if (dataQuincenas) {
        await verificarYGenerarQuincenas(dataPrestamos, dataQuincenas);
      }
    }
    if (dataPagos) setPagos(dataPagos);

    setLoading(false);
  }

  // --- RECURRENCIA AUTOMÁTICA DE INTERESES QUINCENALES ---
  async function verificarYGenerarQuincenas(listaPrestamos: any[], quincenasExistentes: any[]) {
    const hoy = new Date();

    for (const p of listaPrestamos) {
      if (p.estado !== 'activo') continue;

      const fechaInicio = new Date(p.fecha_inicio);
      let fechaCobroObj = new Date(fechaInicio);
      fechaCobroObj.setDate(fechaCobroObj.getDate() + 15);

      const quincenasDelPrestamo = quincenasExistentes.filter(q => q.prestamo_id === p.id);

      while (fechaCobroObj <= hoy) {
        const fechaCobroStr = fechaCobroObj.toISOString().split('T')[0];
        const yaExiste = quincenasDelPrestamo.some(q => q.fecha_cobro === fechaCobroStr);

        if (!yaExiste) {
          const montoInteres = (Number(p.capital_pendiente) * Number(p.tasa_quincenal)) / 100;
          const fechaGraciaObj = new Date(fechaCobroObj);
          fechaGraciaObj.setDate(fechaGraciaObj.getDate() + 10);

          await supabase.from('quincenas_interes').insert([{
            prestamo_id: p.id,
            fecha_cobro: fechaCobroStr,
            fecha_limite_gracia: fechaGraciaObj.toISOString().split('T')[0],
            monto_interes: montoInteres,
            interes_pendiente: montoInteres,
            estado: 'pendiente'
          }]);
        }
        fechaCobroObj.setDate(fechaCobroObj.getDate() + 15);
      }
    }

    const { data: dataQuincenasActualizadas } = await supabase.from('quincenas_interes').select('*');
    if (dataQuincenasActualizadas) setQuincenas(dataQuincenasActualizadas);
  }

  // --- EVALUACIÓN DE ESTADO / MOROSIDAD DEL CLIENTE ---
  function getEstadoCliente(clienteId: string) {
    const prestamosCliente = prestamos.filter(p => p.cliente_id === clienteId && p.estado === 'activo');
    if (prestamosCliente.length === 0) return { label: 'Sin Deuda', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };

    const hoyStr = new Date().toISOString().split('T')[0];
    let tieneMora = false;

    for (const p of prestamosCliente) {
      const qMora = quincenas.some(q => q.prestamo_id === p.id && q.interes_pendiente > 0 && q.fecha_limite_gracia < hoyStr);
      if (qMora) {
        tieneMora = true;
        break;
      }
    }

    if (tieneMora) return { label: 'En Mora', color: 'bg-red-500/10 text-red-400 border-red-500/30' };
    return { label: 'Al Día', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
  }

  // --- ACCIONES ---
  function formatearTelefono(val: string) {
    const num = val.replace(/\D/g, '');
    if (num.length <= 4) return num;
    return `${num.slice(0, 4)}-${num.slice(4, 8)}`;
  }

  async function handleCrearCliente(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoCliente.nombre_completo || !nuevoCliente.cedula || !nuevoCliente.telefono) {
      return alert('Nombre, Cédula y Teléfono son obligatorios');
    }

    const { error } = await supabase.from('clientes').insert([{
      ...nuevoCliente,
      telefono: formatearTelefono(nuevoCliente.telefono)
    }]);

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
      return alert('Completa todos los campos requeridos');
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
      setNuevoPrestamo({ cliente_id: '', monto_original: '', tasa_quincenal: '5', esquema_cobro: '5_20', fecha_inicio: '' });
      cargarDatos();
      alert('Préstamo creado. El sistema calculará automáticamente sus quincenas.');
    }
  }

  async function handleRegistrarPago(e: React.FormEvent) {
    e.preventDefault();
    const prestamo = prestamos.find(p => p.id === nuevoPago.prestamo_id);
    const montoAbonado = parseFloat(nuevoPago.monto_total);

    if (!prestamo || !montoAbonado) return alert('Selecciona préstamo e ingresa monto válido');

    const quincenasPendientes = quincenas
      .filter(q => q.prestamo_id === prestamo.id && q.interes_pendiente > 0)
      .sort((a, b) => new Date(a.fecha_cobro).getTime() - new Date(b.fecha_cobro).getTime());

    const totalInteresPendiente = quincenasPendientes.reduce((acc, curr) => acc + Number(curr.interes_pendiente), 0);

    const aplicadoInteres = Math.min(montoAbonado, totalInteresPendiente);
    const aplicadoCapital = Math.max(0, montoAbonado - aplicadoInteres);

    const { error: errPago } = await supabase.from('pagos').insert([{
      prestamo_id: prestamo.id,
      monto_total: montoAbonado,
      aplicado_interes: aplicadoInteres,
      aplicado_capital: aplicadoCapital,
      notas: `Método: ${nuevoPago.metodo_pago}`
    }]);

    if (errPago) return alert('Error al registrar pago: ' + errPago.message);

    const nuevoCapitalPendiente = Math.max(0, Number(prestamo.capital_pendiente) - aplicadoCapital);
    const nuevoEstado = nuevoCapitalPendiente === 0 ? 'cancelado' : 'activo';

    await supabase.from('prestamos').update({
      capital_pendiente: nuevoCapitalPendiente,
      estado: nuevoEstado
    }).eq('id', prestamo.id);

    let remanente = aplicadoInteres;
    for (const q of quincenasPendientes) {
      if (remanente <= 0) break;
      const aDescontar = Math.min(remanente, Number(q.interes_pendiente));
      const nuevoInteresPend = Number(q.interes_pendiente) - aDescontar;

      await supabase.from('quincenas_interes').update({
        interes_pendiente: nuevoInteresPend,
        estado: nuevoInteresPend === 0 ? 'pagado' : 'pendiente'
      }).eq('id', q.id);

      remanente -= aDescontar;
    }

    setNuevoPago({ prestamo_id: '', monto_total: '', metodo_pago: 'Yappy' });
    cargarDatos();
    alert('Pago procesado correctamente');
  }

  // Métricas Dashboard
  const totalCapitalColocado = prestamos.reduce((acc, curr) => acc + Number(curr.monto_original || 0), 0);
  const totalCapitalPendiente = prestamos.reduce((acc, curr) => acc + Number(curr.capital_pendiente || 0), 0);
  const totalInteresCobrado = pagos.reduce((acc, curr) => acc + Number(curr.aplicado_interes || 0), 0);
  const totalInteresPendiente = quincenas.reduce((acc, curr) => acc + Number(curr.interes_pendiente || 0), 0);

  const hoyStr = new Date().toISOString().split('T')[0];
  const totalInteresAtrasado = quincenas
    .filter(q => q.interes_pendiente > 0 && q.fecha_limite_gracia < hoyStr)
    .reduce((acc, curr) => acc + Number(curr.interes_pendiente || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12 tracking-normal">
      {/* HEADER CORPORATIVO */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1.5 bg-sky-500 rounded-full"></div>
            <h1 className="text-xl font-extrabold tracking-wider text-slate-100 uppercase">CRM Préstamos</h1>
          </div>
          <nav className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1 text-xs font-semibold">
            {(['dashboard', 'clientes', 'prestamos', 'pagos'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 rounded-lg transition-all duration-200 capitalize ${
                  activeTab === tab ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'pagos' ? 'Cobros' : tab}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-8 space-y-8">
        {loading && <p className="text-center text-slate-400 py-16 font-medium">Cargando base de datos...</p>}

        {!loading && activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* TARJETAS RESUMEN SOBRIAS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Capital Colocado</p>
                <p className="text-2xl font-bold text-slate-100 mt-2">${totalCapitalColocado.toFixed(2)}</p>
              </div>
              <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Por Recuperar</p>
                <p className="text-2xl font-bold text-sky-400 mt-2">${totalCapitalPendiente.toFixed(2)}</p>
              </div>
              <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Interés Ganado</p>
                <p className="text-2xl font-bold text-emerald-400 mt-2">${totalInteresCobrado.toFixed(2)}</p>
              </div>
              <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Interés Por Cobrar</p>
                <p className="text-2xl font-bold text-amber-400 mt-2">${totalInteresPendiente.toFixed(2)}</p>
              </div>
              <div className="bg-slate-900/60 p-5 rounded-xl border border-red-900/30">
                <p className="text-[11px] font-bold uppercase tracking-wider text-red-400">En Mora (+10 Días)</p>
                <p className="text-2xl font-bold text-red-500 mt-2">${totalInteresAtrasado.toFixed(2)}</p>
              </div>
            </div>

            {/* TABLA PRINCIPAL DE PRÉSTAMOS */}
            <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 p-6 space-y-4">
              <h2 className="text-base font-bold uppercase tracking-wider text-slate-200">Préstamos en Curso</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Cliente / Cédula</th>
                      <th className="py-3 px-4">Monto Orig.</th>
                      <th className="py-3 px-4">Saldo Capital</th>
                      <th className="py-3 px-4">Tasa</th>
                      <th className="py-3 px-4">Esquema</th>
                      <th className="py-3 px-4">Estado Cliente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {prestamos.map((p) => {
                      const est = getEstadoCliente(p.cliente_id);
                      return (
                        <tr key={p.id} className="hover:bg-slate-800/20">
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-100">{p.clientes?.nombre_completo || 'N/A'}</p>
                            <p className="text-[10px] text-slate-400">Cédula: {p.clientes?.cedula || 'N/A'}</p>
                          </td>
                          <td className="py-3 px-4">${Number(p.monto_original).toFixed(2)}</td>
                          <td className="py-3 px-4 font-bold text-sky-400">${Number(p.capital_pendiente).toFixed(2)}</td>
                          <td className="py-3 px-4">{p.tasa_quincenal}%</td>
                          <td className="py-3 px-4"><span className="bg-slate-800 px-2 py-0.5 rounded text-[10px]">{p.esquema_cobro}</span></td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${est.color}`}>
                              {est.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA CLIENTES */}
        {!loading && activeTab === 'clientes' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <form onSubmit={handleCrearCliente} className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800/80 space-y-4 h-fit">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">Nuevo Cliente</h2>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nombre Completo *</label>
                <input 
                  type="text" 
                  value={nuevoCliente.nombre_completo} 
                  onChange={e => setNuevoCliente({...nuevoCliente, nombre_completo: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  placeholder="Juan Pérez"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Cédula *</label>
                <input 
                  type="text" 
                  value={nuevoCliente.cedula} 
                  onChange={e => setNuevoCliente({...nuevoCliente, cedula: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  placeholder="8-888-8888"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Teléfono (Celular) *</label>
                <input 
                  type="text" 
                  value={nuevoCliente.telefono} 
                  onChange={e => setNuevoCliente({...nuevoCliente, telefono: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  placeholder="6666-6666"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Dirección</label>
                <input 
                  type="text" 
                  value={nuevoCliente.direccion} 
                  onChange={e => setNuevoCliente({...nuevoCliente, direccion: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  placeholder="Panamá"
                />
              </div>
              <button type="submit" className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold py-3 rounded-xl text-xs transition">
                Registrar Cliente
              </button>
            </form>

            <div className="lg:col-span-2 bg-slate-900/60 p-6 rounded-2xl border border-slate-800/80 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">Directorio de Clientes ({clientes.length})</h2>
              <div className="divide-y divide-slate-800/40">
                {clientes.map(c => {
                  const est = getEstadoCliente(c.id);
                  return (
                    <div key={c.id} className="py-4 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-slate-100 text-sm">{c.nombre_completo}</p>
                        <p className="text-xs text-slate-400">Cédula: <strong className="text-slate-300">{c.cedula || 'N/A'}</strong> | Celular: {c.telefono}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${est.color}`}>
                        {est.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA PRÉSTAMOS */}
        {!loading && activeTab === 'prestamos' && (
          <div className="max-w-xl mx-auto bg-slate-900/60 p-8 rounded-2xl border border-slate-800/80 space-y-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">Crear Nuevo Préstamo</h2>
            <form onSubmit={handleCrearPrestamo} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Cliente *</label>
                <select 
                  value={nuevoPrestamo.cliente_id} 
                  onChange={e => setNuevoPrestamo({...nuevoPrestamo, cliente_id: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  <option value="">-- Selecciona Cliente --</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre_completo} (Cédula: {c.cedula})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Monto ($) *</label>
                  <input 
                    type="number" 
                    value={nuevoPrestamo.monto_original} 
                    onChange={e => setNuevoPrestamo({...nuevoPrestamo, monto_original: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                    placeholder="1000.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Tasa Quincenal (%) *</label>
                  <input 
                    type="number" 
                    value={nuevoPrestamo.tasa_quincenal} 
                    onChange={e => setNuevoPrestamo({...nuevoPrestamo, tasa_quincenal: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Esquema Cobro *</label>
                  <select 
                    value={nuevoPrestamo.esquema_cobro} 
                    onChange={e => setNuevoPrestamo({...nuevoPrestamo, esquema_cobro: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    <option value="5_20">Días 5 y 20</option>
                    <option value="10_25">Días 10 y 25</option>
                    <option value="15_30">Días 15 y 30</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Fecha Desembolso *</label>
                  <input 
                    type="date" 
                    value={nuevoPrestamo.fecha_inicio} 
                    onChange={e => setNuevoPrestamo({...nuevoPrestamo, fecha_inicio: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <button type="submit" className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold py-3 rounded-xl text-xs transition mt-2">
                Generar Préstamo
              </button>
            </form>
          </div>
        )}

        {/* PESTAÑA COBROS / PAGOS */}
        {!loading && activeTab === 'pagos' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <form onSubmit={handleRegistrarPago} className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800/80 space-y-4 h-fit">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">Registrar Cobro</h2>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Préstamo Activo *</label>
                <select 
                  value={nuevoPago.prestamo_id} 
                  onChange={e => setNuevoPago({...nuevoPago, prestamo_id: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  <option value="">-- Selecciona Préstamo --</option>
                  {prestamos.filter(p => p.estado === 'activo').map(p => (
                    <option key={p.id} value={p.id}>
                      {p.clientes?.nombre_completo} (Cédula: {p.clientes?.cedula}) - Saldo: ${Number(p.capital_pendiente).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Monto Cobrado ($) *</label>
                <input 
                  type="number" 
                  value={nuevoPago.monto_total} 
                  onChange={e => setNuevoPago({...nuevoPago, monto_total: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  placeholder="50.00"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Método de Pago *</label>
                <select 
                  value={nuevoPago.metodo_pago} 
                  onChange={e => setNuevoPago({...nuevoPago, metodo_pago: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  <option value="Yappy">Yappy</option>
                  <option value="ACH">ACH (Transferencia)</option>
                </select>
              </div>

              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl text-xs transition">
                Procesar Cobro
              </button>
            </form>

            <div className="lg:col-span-2 bg-slate-900/60 p-6 rounded-2xl border border-slate-800/80 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">Historial de Cobros</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Cliente / Cédula</th>
                      <th className="py-3 px-4">Monto Total</th>
                      <th className="py-3 px-4">A Interés</th>
                      <th className="py-3 px-4">A Capital</th>
                      <th className="py-3 px-4">Método</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {pagos.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/20">
                        <td className="py-3 px-4 text-slate-400">{new Date(p.fecha_pago).toLocaleDateString()}</td>
                        <td className="py-3 px-4 font-bold text-slate-100">
                          {p.prestamos?.clientes?.nombre_completo || 'N/A'}
                          <p className="text-[10px] text-slate-400 font-normal">Cédula: {p.prestamos?.clientes?.cedula || 'N/A'}</p>
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-400">${Number(p.monto_total).toFixed(2)}</td>
                        <td className="py-3 px-4 text-amber-400">${Number(p.aplicado_interes).toFixed(2)}</td>
                        <td className="py-3 px-4 text-sky-400">${Number(p.aplicado_capital).toFixed(2)}</td>
                        <td className="py-3 px-4 text-slate-300"><span className="bg-slate-800 px-2 py-0.5 rounded text-[10px]">{p.notas}</span></td>
                      </tr>
                    ))}
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
