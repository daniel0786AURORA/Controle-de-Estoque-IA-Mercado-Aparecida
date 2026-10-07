import React, { useState, useRef } from 'react';
import { Camera, Upload as UploadFile, FileText, ArrowLeft, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface ImportacaoDanfeProps {
  onVoltarCadastro: () => void;
  // Futuramente receberá a função que abre o popup de conferência
  onProcessarSucesso?: (dados: any) => void; 
}

export const ImportacaoDanfeScreen: React.FC<ImportacaoDanfeProps> = ({ 
  onVoltarCadastro, 
  onProcessarSucesso 
}) => {
  const [modo, setModo] = useState<'imagem' | 'codigo'>('imagem');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [chaveAcesso, setChaveAcesso] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lógica de pré-visualização e seleção de arquivo
  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErro('Por favor, selecione apenas arquivos de imagem.');
      return;
    }
    setArquivo(file);
    setPreviewUrl(URL.createObjectURL(file));
    setErro(null);
  };

  // Validação básica do formato da Chave de Acesso NF-e (44 dígitos numéricos)
  const validarChaveAcesso = (chave: string) => {
    const regex = /^[0-9]{44}$/;
    return regex.test(chave.replace(/\s/g, ''));
  };

  // Lógica principal do botão "Processar" (Sandbox)
  const handleProcessar = async () => {
    setErro(null);
    setIsProcessing(true);

    try {
      // Validações obrigatórias antes de chamar qualquer backend futuro
      if (modo === 'imagem' && !arquivo) {
        throw new Error('Selecione uma foto ou arquivo da nota fiscal.');
      }
      
      if (modo === 'codigo') {
        const chaveLimpa = chaveAcesso.replace(/\s/g, '');
        if (!validarChaveAcesso(chaveLimpa)) {
          throw new Error('Chave de acesso inválida. O formato correto possui 44 dígitos numéricos.');
        }
      }

      // Se for imagem, tentamos enviar para a API real /api/danfe ou simulação
      let resultadoApi: any = null;
      if (modo === 'imagem' && arquivo) {
        try {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(arquivo);
          });
          const base64 = await base64Promise;
          
          const resp = await fetch('/api/danfe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imagem: base64, mimeType: arquivo.type })
          });
          if (resp.ok) {
            resultadoApi = await resp.json();
          }
        } catch (apiErr) {
          console.warn('Processamento real da API falhou ou em fallback sandbox:', apiErr);
        }
      }

      // SIMULAÇÃO DO FLUXO FUTURO CASO NÃO TENHA DADOS DA API
      if (!resultadoApi) {
        await new Promise(resolve => setTimeout(resolve, 1500)); 
      }
      
      console.log(`[SANDBOX] Processando via ${modo}`, modo === 'imagem' ? arquivo : chaveAcesso, resultadoApi);
      
      // Ao ter sucesso, chama a função que abrirá o Popup de Conferência
      if (onProcessarSucesso) {
        onProcessarSucesso({ modo, arquivo, chaveAcesso, dadosExtraidos: resultadoApi });
      }

    } catch (err: any) {
      setErro(err.message || 'Ocorreu um erro ao iniciar o processamento.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col items-center">
      {/* Cabeçalho Isolado */}
      <div className="w-full max-w-2xl mb-6 flex items-center justify-between">
        <button 
          onClick={onVoltarCadastro}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium"
        >
          <ArrowLeft size={20} /> Voltar ao Cadastro
        </button>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">
          Importar Produtos via DANFE
        </h1>
      </div>

      {/* Card Principal da Tela */}
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        
        {/* Abas de Seleção de Modo */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => { setModo('imagem'); setErro(null); }}
            className={`flex-1 py-4 px-6 flex items-center justify-center gap-2 font-medium transition-all ${
              modo === 'imagem' 
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            <Camera size={20} /> Foto da Nota
          </button>
          <button
            onClick={() => { setModo('codigo'); setErro(null); }}
            className={`flex-1 py-4 px-6 flex items-center justify-center gap-2 font-medium transition-all ${
              modo === 'codigo' 
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            <FileText size={20} /> Código da Nota (XML/Chave)
          </button>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          
          {/* Área Dinâmica baseada no modo selecionado */}
          {modo === 'imagem' ? (
            <div 
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 transition-all group relative"
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
              
              {previewUrl ? (
                <div className="relative">
                  <img src={previewUrl} alt="Preview" className="max-h-64 mx-auto rounded-md shadow-sm object-contain" />
                  <p className="mt-3 text-sm text-green-600 font-medium flex items-center justify-center gap-1">
                    <CheckCircle2 size={16} /> Imagem selecionada. Clique para trocar.
                  </p>
                </div>
              ) : (
                <>
                  <UploadFile size={48} className="mx-auto text-gray-400 group-hover:text-blue-500 transition-colors mb-4" />
                  <p className="text-lg font-medium text-gray-700">Arraste a foto aqui ou clique para selecionar</p>
                  <p className="text-sm text-gray-500 mt-1">Aceita JPG, PNG, HEIC. O sistema ajusta automaticamente.</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label htmlFor="chave-acesso" className="block text-sm font-medium text-gray-700">
                Chave de Acesso da NF-e (44 dígitos)
              </label>
              <input
                id="chave-acesso"
                type="text"
                maxLength={44}
                value={chaveAcesso}
                onChange={(e) => setChaveAcesso(e.target.value)}
                placeholder="Ex: 4326 0920 2869 5500 0164 5500 1000 2353 7114 8119 1986"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-lg tracking-wider"
              />
              <p className="text-xs text-gray-500">
                Você pode encontrar este número no topo direito do DANFE ou no arquivo XML.
              </p>
            </div>
          )}

          {/* Feedback de Erro Inline */}
          {erro && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          {/* Botão de Ação Principal */}
          <button
            onClick={handleProcessar}
            disabled={isProcessing}
            className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-sm ${
              isProcessing 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.99]'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 size={24} className="animate-spin" /> Processando...
              </>
            ) : (
              <>
                ▶ Iniciar Importação
              </>
            )}
          </button>
          
          <p className="text-center text-xs text-gray-400">
            Os dados serão analisados em uma tela de conferência antes de serem salvos no estoque.
          </p>

        </div>
      </div>
    </div>
  );
};
