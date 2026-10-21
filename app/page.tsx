'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Home() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clientes' | 'prestamos' | 'pagos' | 'csv'>('dashboard');
  const [loading, setLoading] = useState(true);

  // Estados
  const [clientes, setClientes] = useState<any[]>([]);
  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [quincenas, setQuincenas] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);

  // Formularios
  const [nuevoCliente, setNuevoCliente] = useState({ nombre_completo: '', cedula: '', telefono: '', direccion: '' });
  const [nuevoPrestamo, setNuevoPrestamo] = useState({ cliente_id: '', monto_original: '', tasa_quincenal: '10', esquema_cobro: '15_30', fecha_inicio: '' });
  const [nuevoPago, setNuevoPago] = useState({ prestamo_id: '', monto_total: '', metodo_pago: 'Yappy', fecha_pago: '' });
  const [csvTexto, setCsvTexto] = useState('');

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
      if (dataQuincenas) await verificarYGenerarQuincenas(dataPrestamos, dataQuincenas);
    }
    if (dataPagos) setPagos(dataPagos);

    setLoading(false);
  }

  // --- LÓGICA DE QUINCENAS CORREGIDA ---
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
          // El interés quincenal se fija en el costo por periodo sin sobreacumulación fantasma
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

  function getEstadoCliente(clienteId: string) {
    const prestamosCliente = prestamos.filter(p => p.cliente_id === clienteId && p.estado === 'activo');
    if (prestamosCliente.length === 0) return { label: 'Sin Deuda', color: 'bg-emerald-900 bg-opacity-30 text-emerald-400 border-emerald-800' };

    const hoyStr = new Date().toISOString().split('T')[0];
    let tieneMora = false;

    for (const p of prestamosCliente) {
      const qMora = quincenas.some(q => q.prestamo_id === p.id && q.interes_pendiente > 0 && q.fecha_limite_gracia < hoyStr);
      if (qMora) {
        tieneMora = true;
        break;
      }
    }

    if (tieneMora) return { label: 'En Mora', color: 'bg-red-900 bg-opacity-30 text-red-400 border-red-800' };
    return { label: 'Al Día', color: 'bg-emerald-900 bg-opacity-30 text-emerald-400 border-emerald-800' };
  }

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

  async function handleBorrarCliente(id: string, nombre: string) {
    if (confirm(`¿Estás seguro de borrar a ${nombre}? Se eliminarán sus registros.`)) {
      const { error } = await supabase.from('clientes').delete().eq('id', id);
      if (error) {
        alert('Error al borrar cliente: ' + error.message);
      } else {
        cargarDatos();
        alert('Cliente eliminado correctamente');
      }
    }
  }

  async function handleCargarCSV(e: React.FormEvent) {
    e.preventDefault();
    if (!csvTexto.trim()) return alert('Pega el contenido del CSV');

    const filas = csvTexto.trim().split('\n');
    let creados = 0;

    for (const fila of filas) {
      const columnas = fila.split(',');
      if (columnas.length >= 3) {
        const nombre = columnas[0]?.trim();
        const cedula = columnas[1]?.trim();
        const telefono = columnas[2]?.trim();
        const direccion = columnas[3]?.trim() || 'Panamá';

        if (nombre && cedula && telefono) {
          await supabase.from('clientes').insert([{
            nombre_completo: nombre,
            cedula: cedula,
            telefono: formatearTelefono(telefono),
            direccion: direccion
          }]);
          creados++;
        }
      }
    }

    setCsvTexto('');
    cargarDatos();
    alert(`Se importaron ${creados} clientes con éxito desde el CSV.`);
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
      setNuevoPrestamo({ cliente_id: '', monto_original: '', tasa_quincenal: '10', esquema_cobro: '15_30', fecha_inicio: '' });
      cargarDatos();
      alert('Préstamo registrado');
    }
  }

  // --- PRELACIÓN DE PAGO CORREGIDA ---
  async function handleRegistrarPago(e: React.FormEvent) {
    e.preventDefault();
    const prestamo = prestamos.find(p => p.id === nuevoPago.prestamo_id);
    const montoAbonado = parseFloat(nuevoPago.monto_total);

    if (!prestamo || !montoAbonado) return alert('Selecciona préstamo e ingresa monto válido');

    const quincenaActualInteres = (Number(prestamo.capital_pendiente) * Number(prestamo.tasa_quincenal)) / 100;
    
    // Prelación: Se cobra la cuota de interés simple de la quincena y el remanente amortiza el capital directo
    const aplicadoInteres = Math.min(montoAbonado, quincenaActualInteres);
    const aplicadoCapital = Math.max(0, montoAbonado - aplicadoInteres);

    const payloadPago: any = {
      prestamo_id: prestamo.id,
      monto_total: montoAbonado,
      aplicado_interes: aplicadoInteres,
      aplicado_capital: aplicadoCapital,
      notas: `Método: ${nuevoPago.metodo_pago}`
    };

    if (nuevoPago.fecha_pago) {
      payloadPago.fecha_pago = nuevoPago.fecha_pago;
    }

    const { error: errPago } = await supabase.from('pagos').insert([payloadPago]);

    if (errPago) return alert('Error al registrar pago: ' + errPago.message);

    const nuevoCapitalPendiente = Math.max(0, Number(prestamo.capital_pendiente) - aplicadoCapital);
    const nuevoEstado = nuevoCapitalPendiente === 0 ? 'cancelado' : 'activo';

    await supabase.from('prestamos').update({
      capital_pendiente: nuevoCapitalPendiente,
      estado: nuevoEstado
    }).eq('id', prestamo.id);

    setNuevoPago({ prestamo_id: '', monto_total: '', metodo_pago: 'Yappy', fecha_pago: '' });
    cargarDatos();
    alert('Pago registrado correctamente');
  }

  // Métricas
  const totalCapitalColocado = prestamos.reduce((acc, curr) => acc + Number(curr.monto_original || 0), 0);
  const totalCapitalPendiente = prestamos.reduce((acc, curr) => acc + Number(curr.capital_pendiente || 0), 0);
  const totalInteresCobrado = pagos.reduce((acc, curr) => acc + Number(curr.aplicado_interes || 0), 0);
  const totalInteresPendiente = quincenas.reduce((acc, curr) => acc + Number(curr.interes_pendiente || 0), 0);

  const hoyStr = new Date().toISOString().split('T')[0];
  const totalInteresAtrasado = quincenas
    .filter(q => q.interes_pendiente > 0 && q.fecha_limite_gracia < hoyStr)
    .reduce((acc, curr) => acc + Number(curr.interes_pendiente || 0), 0);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans pb-36">
      {/* HEADER SUPERIOR */}
      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        <header className="flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-400 font-medium">Bienvenido de vuelta</p>
            <h1 className="text-xl font-bold text-white">CRM Préstamos</h1>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-lg">
            CRM
          </div>
        </header>

        {/* TARJETA NEGRA RESUMEN */}
        <div className="bg-gray-900 border border-gray-800 text-white rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-400 font-medium">Capital Activo Pendiente</p>
              <p className="text-3xl font-extrabold mt-1 text-white">${totalCapitalPendiente.toFixed(2)}</p>
            </div>
            <span className="bg-emerald-500 bg-opacity-20 text-emerald-400 text-xs px-3 py-1 rounded-full font-semibold border border-emerald-500 border-opacity-30">
              ${totalInteresCobrado.toFixed(2)} Cobrado
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-800 text-xs">
            <div>
              <p className="text-gray-400">Total Colocado</p>
              <p className="font-bold text-gray-200">${totalCapitalColocado.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-400">Interés Pendiente</p>
              <p className="font-bold text-yellow-400">${totalInteresPendiente.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-400">En Mora</p>
              <p className="font-bold text-red-400">${totalInteresAtrasado.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL DARK MODE */}
      <main className="max-w-4xl mx-auto px-4 mt-6">
        {loading && <p className="text-center text-gray-400 py-12 text-sm">Cargando información...</p>}

        {!loading && activeTab === 'dashboard' && (
          <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 space-y-4">
            <h2 className="text-base font-bold text-white">Préstamos Activos</h2>
            <div className="divide-y divide-gray-800">
              {prestamos.map((p) => {
                const est = getEstadoCliente(p.cliente_id);
                return (
                  <div key={p.id} className="py-4 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-white text-sm">{p.clientes?.nombre_completo || 'N/A'}</p>
                      <p className="text-gray-400 mt-0.5">Cédula: {p.clientes?.cedula || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-white text-sm">${Number(p.capital_pendiente).toFixed(2)}</p>
                      <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${est.color}`}>
                        {est.label}
                      </span>
                    </div>
                  </div>
                );
              })}
              {prestamos.length === 0 && <p className="text-gray-500 py-4 text-xs text-center">No hay préstamos activos.</p>}
            </div>
          </div>
        )}

        {!loading && activeTab === 'clientes' && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 space-y-4">
              <h2 className="text-base font-bold text-white">Registrar Nuevo Cliente</h2>
              <form onSubmit={handleCrearCliente} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-gray-300 mb-1">Nombre Completo *</label>
                  <input 
                    type="text" 
                    value={nuevoCliente.nombre_completo} 
                    onChange={e => setNuevoCliente({...nuevoCliente, nombre_completo: e.target.value})}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                    placeholder="Juan Pérez"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-gray-300 mb-1">Cédula *</label>
                    <input 
                      type="text" 
                      value={nuevoCliente.cedula} 
                      onChange={e => setNuevoCliente({...nuevoCliente, cedula: e.target.value})}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                      placeholder="8-888-8888"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-300 mb-1">Teléfono *</label>
                    <input 
                      type="text" 
                      value={nuevoCliente.telefono} 
                      onChange={e => setNuevoCliente({...nuevoCliente, telefono: e.target.value})}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                      placeholder="6666-6666"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-medium text-gray-300 mb-1">Dirección</label>
                  <input 
                    type="text" 
                    value={nuevoCliente.direccion} 
                    onChange={e => setNuevoCliente({...nuevoCliente, direccion: e.target.value})}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                    placeholder="Panamá"
                  />
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition mt-2">
                  Guardar Cliente
                </button>
              </form>
            </div>

            <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 space-y-4">
              <h2 className="text-base font-bold text-white">Directorio de Clientes ({clientes.length})</h2>
              <div className="divide-y divide-gray-800">
                {clientes.map(c => {
                  const est = getEstadoCliente(c.id);
                  return (
                    <div key={c.id} className="py-3 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-bold text-white">{c.nombre_completo}</p>
                        <p className="text-gray-400">Cédula: {c.cedula || 'N/A'} | Tel: {c.telefono}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${est.color}`}>
                          {est.label}
                        </span>
                        <button 
                          onClick={() => handleBorrarCliente(c.id, c.nombre_completo)}
                          className="text-red-400 hover:text-red-300 bg-red-950 bg-opacity-40 p-1.5 rounded-lg font-bold text-[10px]"
                        >
                          Borrar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {!loading && activeTab === 'prestamos' && (
          <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 space-y-4">
            <h2 className="text-base font-bold text-white">Nuevo Préstamo</h2>
            <form onSubmit={handleCrearPrestamo} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-gray-300 mb-1">Cliente *</label>
                <select 
                  value={nuevoPrestamo.cliente_id} 
                  onChange={e => setNuevoPrestamo({...nuevoPrestamo, cliente_id: e.target.value})}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Selecciona Cliente --</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre_completo} (Cédula: {c.cedula})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-300 mb-1">Monto ($) *</label>
                  <input 
                    type="number" 
                    value={nuevoPrestamo.monto_original} 
                    onChange={e => setNuevoPrestamo({...nuevoPrestamo, monto_original: e.target.value})}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                    placeholder="1000.00"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-300 mb-1">Tasa Quincenal (%) *</label>
                  <input 
                    type="number" 
                    value={nuevoPrestamo.tasa_quincenal} 
                    onChange={e => setNuevoPrestamo({...nuevoPrestamo, tasa_quincenal: e.target.value})}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-300 mb-1">Esquema Cobro *</label>
                  <select 
                    value={nuevoPrestamo.esquema_cobro} 
                    onChange={e => setNuevoPrestamo({...nuevoPrestamo, esquema_cobro: e.target.value})}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="5_20">Días 5 y 20</option>
                    <option value="10_25">Días 10 y 25</option>
                    <option value="15_30">Días 15 y 30</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-gray-300 mb-1">Fecha Desembolso *</label>
                  <input 
                    type="date" 
                    value={nuevoPrestamo.fecha_inicio} 
                    onChange={e => setNuevoPrestamo({...nuevoPrestamo, fecha_inicio: e.target.value})}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition mt-2">
                Generar Préstamo
              </button>
            </form>
          </div>
        )}

        {!loading && activeTab === 'pagos' && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 space-y-4">
              <h2 className="text-base font-bold text-white">Registrar Cobro</h2>
              <form onSubmit={handleRegistrarPago} className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-gray-300 mb-1">Préstamo Activo *</label>
                  <select 
                    value={nuevoPago.prestamo_id} 
                    onChange={e => setNuevoPago({...nuevoPago, prestamo_id: e.target.value})}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- Selecciona Préstamo --</option>
                    {prestamos.filter(p => p.estado === 'activo').map(p => (
                      <option key={p.id} value={p.id}>
                        {p.clientes?.nombre_completo} (Cédula: {p.clientes?.cedula}) - Saldo: ${Number(p.capital_pendiente).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-gray-300 mb-1">Monto ($) *</label>
                    <input 
                      type="number" 
                      value={nuevoPago.monto_total} 
                      onChange={e => setNuevoPago({...nuevoPago, monto_total: e.target.value})}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                      placeholder="50.00"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-300 mb-1">Método de Pago *</label>
                    <select 
                      value={nuevoPago.metodo_pago} 
                      onChange={e => setNuevoPago({...nuevoPago, metodo_pago: e.target.value})}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="Yappy">Yappy</option>
                      <option value="ACH">ACH (Transferencia)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-gray-300 mb-1">Fecha Real de Pago (Opcional)</label>
                  <input 
                    type="date" 
                    value={nuevoPago.fecha_pago} 
                    onChange={e => setNuevoPago({...nuevoPago, fecha_pago: e.target.value})}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* BOTÓN VISIBLE CON MARGEN INFERIOR */}
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition shadow-lg">
                  Procesar Cobro
                </button>
              </form>
            </div>

            <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 space-y-4">
              <h2 className="text-base font-bold text-white">Historial de Cobros</h2>
              <div className="divide-y divide-gray-800">
                {pagos.map((p) => (
                  <div key={p.id} className="py-3 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-white">{p.prestamos?.clientes?.nombre_completo || 'N/A'}</p>
                      <p className="text-gray-400">{new Date(p.fecha_pago).toLocaleDateString()} | {p.notas}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-400 text-sm">+${Number(p.monto_total).toFixed(2)}</p>
                      <p className="text-[10px] text-gray-400">Int: ${Number(p.aplicado_interes).toFixed(2)} \vert{} Cap:${Number(p.aplicado_capital).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!loading && activeTab === 'csv' && (
          <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 space-y-4">
            <h2 className="text-base font-bold text-white">Importación Masiva de Clientes (CSV)</h2>
            <p className="text-xs text-gray-400">
              Pega la lista desde Excel en formato separado por comas:
              <br />
              <code className="bg-gray-950 px-2 py-1 rounded text-[10px] text-gray-300 font-mono mt-1 block">
                Nombre Completo, Cedula, Telefono, Direccion
              </code>
            </p>
            <form onSubmit={handleCargarCSV} className="space-y-3 text-xs">
              <textarea
                rows={6}
                value={csvTexto}
                onChange={e => setCsvTexto(e.target.value)}
                placeholder="Juan Perez, 8-888-8888, 6666-6666, Panama&#10;Maria Gomez, 3-333-3333, 6555-5555, Colon"
                className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white font-mono focus:outline-none focus:border-blue-500"
              />
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition">
                Cargar Clientes a Supabase
              </button>
            </form>
          </div>
        )}
      </main>

      {/* MENÚ FLOTANTE NAVEGACIÓN */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white rounded-full p-1.5 shadow-2xl flex items-center gap-1 border border-gray-800 z-50">
        {(['dashboard', 'clientes', 'prestamos', 'pagos', 'csv'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3.5 py-2 rounded-full text-[11px] font-semibold capitalize transition ${
              activeTab === tab ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab === 'pagos' ? 'Cobros' : tab === 'csv' ? 'CSV' : tab}
          </button>
        ))}
      </div>
    </div>
  );
}
