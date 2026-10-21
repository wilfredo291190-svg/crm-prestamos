'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Home() {
  // Estado de Sesión y Autenticación
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Campos del Formulario de Auth
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Datos Adicionales de Registro
  const [regNombre, setRegNombre] = useState('');
  const [regEmpresa, setRegEmpresa] = useState('');
  const [regTelefono, setRegTelefono] = useState('');

  // Estados de CRM
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clientes' | 'prestamos' | 'pagos' | 'csv'>('dashboard');
  const [loading, setLoading] = useState(true);

  // Estados de Datos
  const [clientes, setClientes] = useState<any[]>([]);
  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [quincenas, setQuincenas] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);

  // Formularios CRM
  const [nuevoCliente, setNuevoCliente] = useState({ nombre_completo: '', cedula: '', telefono: '', direccion: '' });
  const [nuevoPrestamo, setNuevoPrestamo] = useState({ 
    cliente_id: '', 
    monto_original: '', 
    tasa_quincenal: '', 
    esquema_cobro: '15_30', 
    dia: '', 
    mes: '', 
    anio: new Date().getFullYear().toString() 
  });
  const [nuevoPago, setNuevoPago] = useState({ 
    prestamo_id: '', 
    monto_total: '', 
    metodo_pago: 'Yappy', 
    dia: '', 
    mes: '', 
    anio: new Date().getFullYear().toString() 
  });
  const [csvTexto, setCsvTexto] = useState('');

  // --- SISTEMA DE MODALES Y ALERTAS NATIVAS PWA (DARK MODE) ---
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    tipo: 'alerta' | 'confirmacion' | 'exito' | 'error';
    titulo: string;
    mensaje: string;
    onAceptar?: () => void;
  }>({
    isOpen: false,
    tipo: 'alerta',
    titulo: '',
    mensaje: ''
  });

  function mostrarAlerta(titulo: string, mensaje: string, tipo: 'alerta' | 'exito' | 'error' = 'alerta') {
    setModalConfig({ isOpen: true, tipo, titulo, mensaje });
  }

  function mostrarConfirmacion(titulo: string, mensaje: string, onAceptar: () => void) {
    setModalConfig({ isOpen: true, tipo: 'confirmacion', titulo, mensaje, onAceptar });
  }

  function cerrarModal() {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  }

  // CÁLCULO DE FUERZA DE CONTRASEÑA
  function calcularFuerzaPassword(pass: string) {
    if (!pass) return { score: 0, label: '', color: 'bg-gray-800' };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) || /[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass) && pass.length >= 8) score += 1;

    if (score === 1) return { score: 1, label: 'Débil', color: 'bg-red-500' };
    if (score === 2) return { score: 2, label: 'Media', color: 'bg-yellow-500' };
    if (score === 3) return { score: 3, label: 'Fuerte', color: 'bg-emerald-500' };
    return { score: 0, label: 'Muy Débil', color: 'bg-red-500' };
  }

  const fuerzaPass = calcularFuerzaPassword(authPassword);

  // VALIDAR SESIÓN DE SUPABASE
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      if (session) cargarDatos(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) cargarDatos(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      return mostrarAlerta('Campos Requeridos', 'Por favor ingresa tu correo y contraseña.', 'alerta');
    }

    if (authPassword.length < 8) {
      return mostrarAlerta('Contraseña Muy Corta', 'La contraseña debe tener mínimo 8 caracteres.', 'alerta');
    }

    setIsSubmitting(true);

    try {
      if (isRegistering) {
        if (!regNombre || !regEmpresa) {
          setIsSubmitting(false);
          return mostrarAlerta('Datos Incompletos', 'Por favor ingresa tu Nombre y el Nombre de tu Empresa.', 'alerta');
        }

        const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}` : 'https://prestao-app.vercel.app';
        
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              nombre_completo: regNombre,
              empresa: regEmpresa,
              telefono: regTelefono
            }
          }
        });
        
        setIsSubmitting(false);

        if (error) {
          if (error.message.includes('already registered') || error.message.includes('User already exists')) {
            mostrarAlerta('Correo Ya Registrado', 'Este correo electrónico ya tiene una cuenta activa. Por favor inicia sesión.', 'error');
          } else {
            mostrarAlerta('Error de Registro', error.message, 'error');
          }
        } else if (data?.user && data?.session) {
          mostrarAlerta('Cuenta Creada', 'Bienvenido a Presta\'o. Tu sesión ha sido iniciada.', 'exito');
        } else {
          mostrarAlerta(
            'Verificación Enviada', 
            `Hemos enviado un correo de confirmación a ${authEmail}. Haz clic en el enlace del mensaje para activar tu cuenta.`, 
            'exito'
          );
          setIsRegistering(false);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });

        setIsSubmitting(false);

        if (error) {
          mostrarAlerta('Error de Acceso', 'Credenciales incorrectas o correo no verificado.', 'error');
        }
      }
    } catch (err: any) {
      setIsSubmitting(false);
      mostrarAlerta('Error', err.message || 'Ocurrió un error inesperado', 'error');
    }
  }

  async function handleSignOut() {
    mostrarConfirmacion('Cerrar Sesión', '¿Estás seguro de que deseas salir del sistema?', async () => {
      await supabase.auth.signOut();
      setSession(null);
      setClientes([]);
      setPrestamos([]);
      setPagos([]);
    });
  }

  function cambiarPestana(tab: 'dashboard' | 'clientes' | 'prestamos' | 'pagos' | 'csv') {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // CARGAR DATOS AISLADOS POR USUARIO (MULTITENANCY)
  async function cargarDatos(userId?: string) {
    setLoading(true);
    const activeUserId = userId || session?.user?.id;

    if (!supabaseUrl || !supabaseAnonKey || !activeUserId) {
      setLoading(false);
      return;
    }

    const { data: dataClientes } = await supabase.from('clientes').select('*').eq('user_id', activeUserId).order('creado_en', { ascending: false });
    const { data: dataPrestamos } = await supabase.from('prestamos').select('*, clientes(*)').eq('user_id', activeUserId).order('creado_en', { ascending: false });
    const { data: dataQuincenas } = await supabase.from('quincenas_interes').select('*');
    const { data: dataPagos } = await supabase.from('pagos').select('*, prestamos(*, clientes(*))').eq('user_id', activeUserId).order('fecha_pago', { ascending: false });

    if (dataClientes) setClientes(dataClientes);
    if (dataPrestamos) setPrestamos(dataPrestamos);
    if (dataQuincenas) setQuincenas(dataQuincenas);
    if (dataPagos) setPagos(dataPagos);

    setLoading(false);
  }

  function getEstadoCliente(clienteId: string) {
    const prestamosCliente = prestamos.filter(p => p.cliente_id === clienteId && p.estado === 'activo');
    if (prestamosCliente.length === 0) return { label: 'Sin Deuda', color: 'bg-emerald-900/40 text-emerald-400 border-emerald-800' };

    const hoyStr = new Date().toISOString().split('T')[0];
    let tieneMora = false;

    for (const p of prestamosCliente) {
      const qMora = quincenas.some(q => q.prestamo_id === p.id && q.interes_pendiente > 0 && q.fecha_limite_gracia < hoyStr);
      if (qMora) {
        tieneMora = true;
        break;
      }
    }

    if (tieneMora) return { label: 'En Mora', color: 'bg-red-900/40 text-red-400 border-red-800' };
    return { label: 'Al Día', color: 'bg-emerald-900/40 text-emerald-400 border-emerald-800' };
  }

  function formatearTelefono(val: string) {
    const num = val.replace(/\D/g, '');
    if (num.length <= 4) return num;
    return `${num.slice(0, 4)}-${num.slice(4, 8)}`;
  }

  async function handleCrearCliente(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoCliente.nombre_completo || !nuevoCliente.cedula || !nuevoCliente.telefono) {
      return mostrarAlerta('Campos Requeridos', 'Por favor ingresa Nombre, Cédula y Teléfono.', 'alerta');
    }

    const { error } = await supabase.from('clientes').insert([{
      ...nuevoCliente,
      user_id: session?.user?.id,
      telefono: formatearTelefono(nuevoCliente.telefono)
    }]);

    if (error) {
      mostrarAlerta('Error', 'No se pudo crear el cliente: ' + error.message, 'error');
    } else {
      setNuevoCliente({ nombre_completo: '', cedula: '', telefono: '', direccion: '' });
      cargarDatos();
      mostrarAlerta('Cliente Registrado', 'El cliente fue guardado correctamente.', 'exito');
    }
  }

  function handleBorrarCliente(id: string, nombre: string) {
    mostrarConfirmacion(
      '¿Eliminar Cliente?',
      `¿Estás seguro de eliminar a ${nombre}? Se borrarán sus registros.`,
      async () => {
        const { error } = await supabase.from('clientes').delete().eq('id', id);
        if (error) {
          mostrarAlerta('Error al eliminar', error.message, 'error');
        } else {
          cargarDatos();
          mostrarAlerta('Cliente Eliminado', `${nombre} fue removido del sistema.`, 'exito');
        }
      }
    );
  }

  async function handleCargarCSV(e: React.FormEvent) {
    e.preventDefault();
    if (!csvTexto.trim()) return mostrarAlerta('Archivo Vacío', 'Pega el texto del CSV para continuar.', 'alerta');

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
            user_id: session?.user?.id,
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
    mostrarAlerta('Carga Completada', `Se importaron ${creados} clientes exitosamente.`, 'exito');
  }

  async function handleCrearPrestamo(e: React.FormEvent) {
    e.preventDefault();
    const monto = parseFloat(nuevoPrestamo.monto_original);
    const tasa = parseFloat(nuevoPrestamo.tasa_quincenal);

    if (!nuevoPrestamo.cliente_id || !monto || isNaN(tasa) || !nuevoPrestamo.dia || !nuevoPrestamo.mes || !nuevoPrestamo.anio) {
      return mostrarAlerta('Formulario Incompleto', 'Por favor ingresa todos los datos del préstamo incluyendo la fecha en formato dd/mm/aaaa.', 'alerta');
    }

    const diaPadded = nuevoPrestamo.dia.padStart(2, '0');
    const mesPadded = nuevoPrestamo.mes.padStart(2, '0');
    const fechaISO = `${nuevoPrestamo.anio}-${mesPadded}-${diaPadded}`;

    const { error } = await supabase.from('prestamos').insert([{
      user_id: session?.user?.id,
      cliente_id: nuevoPrestamo.cliente_id,
      monto_original: monto,
      capital_pendiente: monto,
      tasa_quincenal: tasa,
      esquema_cobro: nuevoPrestamo.esquema_cobro,
      fecha_inicio: fechaISO,
      estado: 'activo'
    }]);

    if (error) {
      mostrarAlerta('Error', 'No se pudo generar el préstamo: ' + error.message, 'error');
    } else {
      setNuevoPrestamo({ cliente_id: '', monto_original: '', tasa_quincenal: '', esquema_cobro: '15_30', dia: '', mes: '', anio: new Date().getFullYear().toString() });
      cargarDatos();
      mostrarAlerta('Préstamo Generado', 'El crédito quedó registrado exitosamente.', 'exito');
    }
  }

  async function handleRegistrarPago(e: React.FormEvent) {
    e.preventDefault();
    const prestamo = prestamos.find(p => p.id === nuevoPago.prestamo_id);
    const montoAbonado = parseFloat(nuevoPago.monto_total);

    if (!prestamo || !montoAbonado) return mostrarAlerta('Selección Requerida', 'Selecciona un préstamo e ingresa un monto válido.', 'alerta');

    let fechaPagoEval = new Date();
    if (nuevoPago.dia && nuevoPago.mes && nuevoPago.anio) {
      const diaPadded = nuevoPago.dia.padStart(2, '0');
      const mesPadded = nuevoPago.mes.padStart(2, '0');
      fechaPagoEval = new Date(`${nuevoPago.anio}-${mesPadded}-${diaPadded}`);
    }

    const fechaInicio = new Date(prestamo.fecha_inicio);
    const diasDiferencia = Math.max(1, Math.floor((fechaPagoEval.getTime() - fechaInicio.getTime()) / (1000 * 3600 * 24)));
    const quincenasTranscurridas = Math.max(1, Math.ceil(diasDiferencia / 15));

    const pagosPrevios = pagos.filter(p => p.prestamo_id === prestamo.id);
    const totalInteresYaPagado = pagosPrevios.reduce((acc, curr) => acc + Number(curr.aplicado_interes || 0), 0);

    const interesPorQuincena = (Number(prestamo.capital_pendiente) * Number(prestamo.tasa_quincenal)) / 100;
    const interesTotalAcumuladoHastaHoy = quincenasTranscurridas * interesPorQuincena;
    const interesPendientePorCobrar = Math.max(0, interesTotalAcumuladoHastaHoy - totalInteresYaPagado);

    const aplicadoInteres = Math.min(montoAbonado, interesPendientePorCobrar);
    const aplicadoCapital = Math.max(0, montoAbonado - aplicadoInteres);

    const payloadPago: any = {
      user_id: session?.user?.id,
      prestamo_id: prestamo.id,
      monto_total: montoAbonado,
      aplicado_interes: aplicadoInteres,
      aplicado_capital: aplicadoCapital,
      fecha_pago: fechaPagoEval.toISOString().split('T')[0],
      notas: `Método: ${nuevoPago.metodo_pago}`
    };

    const { error: errPago } = await supabase.from('pagos').insert([payloadPago]);

    if (errPago) return mostrarAlerta('Error de Pago', errPago.message, 'error');

    const nuevoCapitalPendiente = Math.max(0, Number(prestamo.capital_pendiente) - aplicadoCapital);
    const nuevoEstado = nuevoCapitalPendiente === 0 ? 'cancelado' : 'activo';

    await supabase.from('prestamos').update({
      capital_pendiente: nuevoCapitalPendiente,
      estado: nuevoEstado
    }).eq('id', prestamo.id);

    setNuevoPago({ prestamo_id: '', monto_total: '', metodo_pago: 'Yappy', dia: '', mes: '', anio: new Date().getFullYear().toString() });
    cargarDatos();
    mostrarAlerta(
      'Cobro Procesado', 
      `Abonado: $${aplicadoInteres.toFixed(2)} a Interés | $${aplicadoCapital.toFixed(2)} a Capital. Nuevo saldo restante: $${nuevoCapitalPendiente.toFixed(2)}`,
      'exito'
    );
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

  // ESTILO DE INPUT: FONDO BLANCO PURO Y TEXTO NEGRO NEGRO (#000000)
  const fieldInputStyle = "w-full bg-white text-black font-extrabold text-sm border border-gray-300 rounded-xl p-3.5 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all";

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-sm font-semibold text-gray-400 animate-pulse">Cargando Presta'o...</p>
      </div>
    );
  }

  // --- VISTA 1: LOGIN / REGISTRO ---
  if (!session) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
        <style jsx global>{`
          input, select, textarea {
            color: #000000 !important;
            background-color: #ffffff !important;
            -webkit-text-fill-color: #000000 !important;
            opacity: 1 !important;
          }
          input::placeholder {
            color: #6b7280 !important;
            -webkit-text-fill-color: #6b7280 !important;
          }
        `}</style>
        
        <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl space-y-6">
          
          {/* HEADER DEL PORTAL DE ENTRADA CON LOGO VECTORIAL HANDSHAKE */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto bg-gray-950 rounded-2xl border border-gray-800 p-2.5 flex items-center justify-center shadow-lg">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <path d="M 15 85 V 15 C 15 10, 20 5, 28 5 H 38 C 46 5, 52 10, 52 15 V 35 L 70 20 C 76 15, 85 17, 89 23 C 93 29, 91 38, 85 42 L 52 65 V 85 C 52 90, 46 95, 38 95 H 28 C 20 95, 15 90, 15 85 Z" fill="#1D4ED8"/>
                <path d="M 45 10 C 72 10, 95 24, 95 50 C 95 72, 75 88, 52 88 L 38 88 L 52 74 C 68 74, 78 63, 78 50 C 78 36, 64 26, 45 26 H 36 V 10 Z" fill="#38BDF8"/>
              </svg>
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-wide">Presta'o</h1>
            <p className="text-xs text-gray-400">Gestión Inteligente de Créditos</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4 text-xs" autoComplete="off">
            
            {/* CAMPOS ADICIONALES SOLO EN MODO REGISTRO */}
            {isRegistering && (
              <>
                <div>
                  <label className="block font-semibold text-gray-300 mb-1">Nombre Completo *</label>
                  <input 
                    type="text" 
                    value={regNombre} 
                    onChange={e => setRegNombre(e.target.value)}
                    className={fieldInputStyle}
                    placeholder="Ej: Juan Pérez"
                    required={isRegistering}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-300 mb-1">Nombre Financiera / Empresa *</label>
                  <input 
                    type="text" 
                    value={regEmpresa} 
                    onChange={e => setRegEmpresa(e.target.value)}
                    className={fieldInputStyle}
                    placeholder="Ej: Inversiones Pérez"
                    required={isRegistering}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-300 mb-1">Teléfono Móvil</label>
                  <input 
                    type="text" 
                    value={regTelefono} 
                    onChange={e => setRegTelefono(e.target.value)}
                    className={fieldInputStyle}
                    placeholder="Ej: 6666-6666"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block font-semibold text-gray-300 mb-1">Correo Electrónico *</label>
              <input 
                type="email" 
                value={authEmail} 
                onChange={e => setAuthEmail(e.target.value)}
                className={fieldInputStyle}
                placeholder="usuario@ejemplo.com"
                autoComplete="new-email"
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block font-semibold text-gray-300">Contraseña *</label>
                <span className="text-[10px] text-gray-400">Mínimo 8 caracteres</span>
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={authPassword} 
                  onChange={e => setAuthPassword(e.target.value)}
                  className={fieldInputStyle}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black font-bold text-xs"
                >
                  {showPassword ? "🙈 Ocultar" : "👁️ Ver"}
                </button>
              </div>

              {/* MEDIDOR DE FUERZA DE CONTRASEÑA */}
              {authPassword.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1 h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-300 ${fuerzaPass.score >= 1 ? fuerzaPass.color : 'bg-transparent'} w-1/3`} />
                    <div className={`h-full transition-all duration-300 ${fuerzaPass.score >= 2 ? fuerzaPass.color : 'bg-transparent'} w-1/3`} />
                    <div className={`h-full transition-all duration-300 ${fuerzaPass.score >= 3 ? fuerzaPass.color : 'bg-transparent'} w-1/3`} />
                  </div>
                  <p className="text-[10px] text-gray-400 text-right">
                    Seguridad: <span className="font-bold text-gray-200">{fuerzaPass.label}</span>
                  </p>
                </div>
              )}
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold py-3.5 rounded-xl transition shadow-lg text-sm mt-2"
            >
              {isSubmitting ? 'Procesando...' : isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-gray-800">
            <button 
              onClick={() => {
                setIsRegistering(!isRegistering);
                setAuthEmail('');
                setAuthPassword('');
              }}
              className="text-xs text-blue-400 hover:underline font-semibold"
            >
              {isRegistering ? '¿Ya tienes cuenta? Inicia Sesión' : '¿No tienes cuenta? Regístrate aquí'}
            </button>
          </div>
        </div>

        {/* MODAL PWA (DARK MODE) */}
        {modalConfig.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 text-center">
              
              <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center text-lg font-bold">
                {modalConfig.tipo === 'confirmacion' && <span className="bg-red-500/20 text-red-400 border border-red-500/30 w-full h-full rounded-full flex items-center justify-center">⚠️</span>}
                {modalConfig.tipo === 'exito' && <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 w-full h-full rounded-full flex items-center justify-center">✓</span>}
                {modalConfig.tipo === 'error' && <span className="bg-red-500/20 text-red-400 border border-red-500/30 w-full h-full rounded-full flex items-center justify-center">✕</span>}
                {modalConfig.tipo === 'alerta' && <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 w-full h-full rounded-full flex items-center justify-center">ℹ</span>}
              </div>

              <div>
                <h3 className="text-base font-bold text-white">{modalConfig.titulo}</h3>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">{modalConfig.mensaje}</p>
              </div>

              <button
                onClick={cerrarModal}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl transition shadow-md font-bold text-xs"
              >
                Entendido
              </button>

            </div>
          </div>
        )}
      </div>
    );
  }

  // --- VISTA 2: CRM DASHBOARD COMPLETO (SOLO USUARIOS LOGUEADOS) ---
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans py-6 px-4">
      <style jsx global>{`
        input, select, textarea {
          color: #000000 !important;
          background-color: #ffffff !important;
          -webkit-text-fill-color: #000000 !important;
          opacity: 1 !important;
        }
        input::placeholder, textarea::placeholder {
          color: #6b7280 !important;
          -webkit-text-fill-color: #6b7280 !important;
        }
        select option {
          color: #000000 !important;
          background-color: #ffffff !important;
        }
      `}</style>

      <div className="max-w-3xl mx-auto space-y-6 min-h-[85vh]">
        
        {/* NAVEGACIÓN SUPERIOR CON BOTONES NATIVOS RESPONSIVOS (SIN SCROLLBAR INCORPORADO) */}
        <header className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-900 p-4 rounded-2xl border border-gray-800 shadow-lg">
          
          <div className="flex items-center justify-between w-full sm:w-auto gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-950 border border-gray-800 p-1.5 flex items-center justify-center shadow-md">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <path d="M 15 85 V 15 C 15 10, 20 5, 28 5 H 38 C 46 5, 52 10, 52 15 V 35 L 70 20 C 76 15, 85 17, 89 23 C 93 29, 91 38, 85 42 L 52 65 V 85 C 52 90, 46 95, 38 95 H 28 C 20 95, 15 90, 15 85 Z" fill="#1D4ED8"/>
                  <path d="M 45 10 C 72 10, 95 24, 95 50 C 95 72, 75 88, 52 88 L 38 88 L 52 74 C 68 74, 78 63, 78 50 C 78 36, 64 26, 45 26 H 36 V 10 Z" fill="#38BDF8"/>
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-white tracking-wide leading-none">Presta'o</h1>
                <p className="text-[10px] text-gray-400 mt-0.5">{session?.user?.user_metadata?.empresa || 'Gestión de Créditos'}</p>
              </div>
            </div>
            
            <button 
              onClick={handleSignOut}
              className="sm:hidden text-xs bg-red-950/50 hover:bg-red-900/80 text-red-400 border border-red-800/50 px-2.5 py-1.5 rounded-lg font-bold transition"
            >
              Salir
            </button>
          </div>

          {/* GRID RESPONSIVO INDEPENDIENTE PARA NAVEGACIÓN SIN "IFRAME" O SCROLL LATERAL */}
          <nav className="grid grid-cols-5 bg-gray-950 p-1 rounded-xl border border-gray-800 gap-1 text-xs font-semibold w-full sm:w-auto">
            {(['dashboard', 'clientes', 'prestamos', 'pagos', 'csv'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => cambiarPestana(tab)}
                className={`py-2 px-1 text-center rounded-lg capitalize transition font-bold text-[11px] sm:text-xs ${
                  activeTab === tab ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab === 'pagos' ? 'Cobros' : tab === 'csv' ? 'CSV' : tab}
              </button>
            ))}
          </nav>

          <button 
            onClick={handleSignOut}
            className="hidden sm:block text-xs bg-red-950/50 hover:bg-red-900/80 text-red-400 border border-red-800/50 px-3 py-2 rounded-xl font-bold transition"
          >
            Salir
          </button>
        </header>

        {/* METRICAS PRINCIPALES */}
        <div className="bg-gray-900 border border-gray-800 text-white rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-400 font-medium">Capital Activo Pendiente</p>
              <p className="text-3xl font-black mt-1 text-white">${totalCapitalPendiente.toFixed(2)}</p>
            </div>
            <span className="bg-emerald-500/20 text-emerald-400 text-xs px-3.5 py-1.5 rounded-full font-bold border border-emerald-500/30">
              ${totalInteresCobrado.toFixed(2)} Cobrado
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-800 text-xs">
            <div>
              <p className="text-gray-400">Total Colocado</p>
              <p className="font-bold text-gray-200 mt-0.5">${totalCapitalColocado.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-400">Interés Pendiente</p>
              <p className="font-bold text-yellow-400 mt-0.5">${totalInteresPendiente.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-400">En Mora</p>
              <p className="font-bold text-red-400 mt-0.5">${totalInteresAtrasado.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* SECCIONES */}
        <main>
          {loading && <p className="text-center text-gray-400 py-12 text-sm font-medium">Cargando información...</p>}

          {!loading && activeTab === 'dashboard' && (
            <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 space-y-4 shadow-md">
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
                        <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${est.color}`}>
                          {est.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {prestamos.length === 0 && <p className="text-gray-500 py-6 text-xs text-center">No hay préstamos activos registrados en tu cartera.</p>}
              </div>
            </div>
          )}

          {!loading && activeTab === 'clientes' && (
            <div className="space-y-6">
              <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 space-y-4 shadow-md">
                <h2 className="text-base font-bold text-white">Registrar Nuevo Cliente</h2>
                <form onSubmit={handleCrearCliente} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block font-semibold text-gray-300 mb-1">Nombre Completo *</label>
                    <input 
                      type="text" 
                      value={nuevoCliente.nombre_completo} 
                      onChange={e => setNuevoCliente({...nuevoCliente, nombre_completo: e.target.value})}
                      className={fieldInputStyle}
                      placeholder="Juan Pérez"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-300 mb-1">Cédula *</label>
                      <input 
                        type="text" 
                        value={nuevoCliente.cedula} 
                        onChange={e => setNuevoCliente({...nuevoCliente, cedula: e.target.value})}
                        className={fieldInputStyle}
                        placeholder="8-888-8888"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-300 mb-1">Teléfono *</label>
                      <input 
                        type="text" 
                        value={nuevoCliente.telefono} 
                        onChange={e => setNuevoCliente({...nuevoCliente, telefono: e.target.value})}
                        className={fieldInputStyle}
                        placeholder="6666-6666"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-300 mb-1">Dirección</label>
                    <input 
                      type="text" 
                      value={nuevoCliente.direccion} 
                      onChange={e => setNuevoCliente({...nuevoCliente, direccion: e.target.value})}
                      className={fieldInputStyle}
                      placeholder="Panamá"
                    />
                  </div>
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition mt-2 shadow-md">
                    Guardar Cliente
                  </button>
                </form>
              </div>

              <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 space-y-4 shadow-md">
                <h2 className="text-base font-bold text-white">Directorio de Clientes ({clientes.length})</h2>
                <div className="divide-y divide-gray-800">
                  {clientes.map(c => {
                    const est = getEstadoCliente(c.id);
                    return (
                      <div key={c.id} className="py-3 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-white">{c.nombre_completo}</p>
                          <p className="text-gray-400 mt-0.5">Cédula: {c.cedula || 'N/A'} | Tel: {c.telefono}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${est.color}`}>
                            {est.label}
                          </span>
                          <button 
                            onClick={() => handleBorrarCliente(c.id, c.nombre_completo)}
                            className="text-red-400 hover:text-red-300 bg-red-950/50 border border-red-800/50 px-2.5 py-1 rounded-lg font-bold text-[10px] transition hover:bg-red-900/80"
                          >
                            Borrar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {clientes.length === 0 && <p className="text-gray-500 py-6 text-xs text-center">Aún no has agregado ningún cliente.</p>}
                </div>
              </div>
            </div>
          )}

          {!loading && activeTab === 'prestamos' && (
            <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 space-y-4 shadow-md">
              <h2 className="text-base font-bold text-white">Nuevo Préstamo</h2>
              <form onSubmit={handleCrearPrestamo} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-gray-300 mb-1">Cliente *</label>
                  <select 
                    value={nuevoPrestamo.cliente_id} 
                    onChange={e => setNuevoPrestamo({...nuevoPrestamo, cliente_id: e.target.value})}
                    className={fieldInputStyle}
                  >
                    <option value="">-- Selecciona Cliente --</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre_completo} (Cédula: {c.cedula})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-300 mb-1">Monto ($) *</label>
                    <input 
                      type="number" 
                      value={nuevoPrestamo.monto_original} 
                      onChange={e => setNuevoPrestamo({...nuevoPrestamo, monto_original: e.target.value})}
                      className={fieldInputStyle}
                      placeholder="1000.00"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-300 mb-1">Tasa Quincenal (%) *</label>
                    <input 
                      type="number" 
                      value={nuevoPrestamo.tasa_quincenal} 
                      onChange={e => setNuevoPrestamo({...nuevoPrestamo, tasa_quincenal: e.target.value})}
                      className={fieldInputStyle}
                      placeholder="Ej: 5 o 10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-gray-300 mb-1">Esquema Cobro *</label>
                  <select 
                    value={nuevoPrestamo.esquema_cobro} 
                    onChange={e => setNuevoPrestamo({...nuevoPrestamo, esquema_cobro: e.target.value})}
                    className={fieldInputStyle}
                  >
                    <option value="5_20">Días 5 y 20</option>
                    <option value="10_25">Días 10 y 25</option>
                    <option value="15_30">Días 15 y 30</option>
                  </select>
                </div>

                {/* FECHA LATINA (DD/MM/AAAA) */}
                <div>
                  <label className="block font-semibold text-gray-300 mb-1">Fecha Desembolso (dd/mm/aaaa) *</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input 
                      type="number" 
                      min="1" 
                      max="31"
                      value={nuevoPrestamo.dia} 
                      onChange={e => setNuevoPrestamo({...nuevoPrestamo, dia: e.target.value})}
                      className={fieldInputStyle}
                      placeholder="DD (ej: 15)"
                    />
                    <input 
                      type="number" 
                      min="1" 
                      max="12"
                      value={nuevoPrestamo.mes} 
                      onChange={e => setNuevoPrestamo({...nuevoPrestamo, mes: e.target.value})}
                      className={fieldInputStyle}
                      placeholder="MM (ej: 10)"
                    />
                    <input 
                      type="number" 
                      value={nuevoPrestamo.anio} 
                      onChange={e => setNuevoPrestamo({...nuevoPrestamo, anio: e.target.value})}
                      className={fieldInputStyle}
                      placeholder="AAAA (ej: 2026)"
                    />
                  </div>
                </div>

                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition mt-2 shadow-md">
                  Generar Préstamo
                </button>
              </form>
            </div>
          )}

          {!loading && activeTab === 'pagos' && (
            <div className="space-y-6">
              <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 space-y-4 shadow-md">
                <h2 className="text-base font-bold text-white">Registrar Cobro</h2>
                <form onSubmit={handleRegistrarPago} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-gray-300 mb-1">Préstamo Activo *</label>
                    <select 
                      value={nuevoPago.prestamo_id} 
                      onChange={e => setNuevoPago({...nuevoPago, prestamo_id: e.target.value})}
                      className={fieldInputStyle}
                    >
                      <option value="">-- Selecciona Préstamo --</option>
                      {prestamos.filter(p => p.estado === 'activo').map(p => (
                        <option key={p.id} value={p.id}>
                          {p.clientes?.nombre_completo} (Cédula: {p.clientes?.cedula}) - Saldo: ${Number(p.capital_pendiente).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-300 mb-1">Monto ($) *</label>
                      <input 
                        type="number" 
                        value={nuevoPago.monto_total} 
                        onChange={e => setNuevoPago({...nuevoPago, monto_total: e.target.value})}
                        className={fieldInputStyle}
                        placeholder="50.00"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-300 mb-1">Método de Pago *</label>
                      <select 
                        value={nuevoPago.metodo_pago} 
                        onChange={e => setNuevoPago({...nuevoPago, metodo_pago: e.target.value})}
                        className={fieldInputStyle}
                      >
                        <option value="Yappy">Yappy</option>
                        <option value="ACH">ACH (Transferencia)</option>
                      </select>
                    </div>
                  </div>

                  {/* FECHA LATINA DE PAGO (DD/MM/AAAA) */}
                  <div>
                    <label className="block font-semibold text-gray-300 mb-1">Fecha Real de Pago (Opcional: dd/mm/aaaa)</label>
                    <div className="grid grid-cols-3 gap-2">
                      <input 
                        type="number" 
                        min="1" 
                        max="31"
                        value={nuevoPago.dia} 
                        onChange={e => setNuevoPago({...nuevoPago, dia: e.target.value})}
                        className={fieldInputStyle}
                        placeholder="DD"
                      />
                      <input 
                        type="number" 
                        min="1" 
                        max="12"
                        value={nuevoPago.mes} 
                        onChange={e => setNuevoPago({...nuevoPago, mes: e.target.value})}
                        className={fieldInputStyle}
                        placeholder="MM"
                      />
                      <input 
                        type="number" 
                        value={nuevoPago.anio} 
                        onChange={e => setNuevoPago({...nuevoPago, anio: e.target.value})}
                        className={fieldInputStyle}
                        placeholder="AAAA"
                      />
                    </div>
                  </div>

                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition shadow-lg">
                    Procesar Cobro
                  </button>
                </form>
              </div>

              <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 space-y-4 shadow-md">
                <h2 className="text-base font-bold text-white">Historial de Cobros</h2>
                <div className="divide-y divide-gray-800">
                  {pagos.map((p) => (
                    <div key={p.id} className="py-3 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-bold text-white">{p.prestamos?.clientes?.nombre_completo || 'N/A'}</p>
                        <p className="text-gray-400 mt-0.5">{new Date(p.fecha_pago).toLocaleDateString('es-PA')} | {p.notas}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-400 text-sm">+${Number(p.monto_total).toFixed(2)}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          (Int: ${Number(p.aplicado_interes).toFixed(2)} <span className="text-gray-600 px-1 font-bold">|</span> Cap: ${Number(p.aplicado_capital).toFixed(2)})
                        </p>
                      </div>
                    </div>
                  ))}
                  {pagos.length === 0 && <p className="text-gray-500 py-6 text-xs text-center">Aún no hay cobros registrados.</p>}
                </div>
              </div>
            </div>
          )}

          {!loading && activeTab === 'csv' && (
            <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 space-y-4 shadow-md">
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
                  className={fieldInputStyle}
                />
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition shadow-md">
                  Cargar Lista de Clientes
                </button>
              </form>
            </div>
          )}
        </main>

      </div>

      {/* MODAL PWA (DARK MODE) */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            
            <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center text-lg font-bold">
              {modalConfig.tipo === 'confirmacion' && <span className="bg-red-500/20 text-red-400 border border-red-500/30 w-full h-full rounded-full flex items-center justify-center">⚠️</span>}
              {modalConfig.tipo === 'exito' && <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 w-full h-full rounded-full flex items-center justify-center">✓</span>}
              {modalConfig.tipo === 'error' && <span className="bg-red-500/20 text-red-400 border border-red-500/30 w-full h-full rounded-full flex items-center justify-center">✕</span>}
              {modalConfig.tipo === 'alerta' && <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 w-full h-full rounded-full flex items-center justify-center">ℹ</span>}
            </div>

            <div>
              <h3 className="text-base font-bold text-white">{modalConfig.titulo}</h3>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">{modalConfig.mensaje}</p>
            </div>

            <div className="flex gap-2 pt-2 text-xs font-semibold">
              {modalConfig.tipo === 'confirmacion' ? (
                <>
                  <button
                    onClick={cerrarModal}
                    className="w-1/2 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-xl transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      cerrarModal();
                      if (modalConfig.onAceptar) modalConfig.onAceptar();
                    }}
                    className="w-1/2 bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl transition shadow-md"
                  >
                    Confirmar
                  </button>
                </>
              ) : (
                <button
                  onClick={cerrarModal}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl transition shadow-md font-bold text-xs"
                >
                  Entendido
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
