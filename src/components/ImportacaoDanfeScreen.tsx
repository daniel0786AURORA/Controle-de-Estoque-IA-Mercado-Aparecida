import React, { useState, useRef } from 'react';
import { Camera, Upload as UploadFile, ArrowLeft, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface ImportacaoDanfeProps {
  onVoltarCadastro: () => void;
  onProcessarSucesso?: (dados: any) => void; 
}

export const ImportacaoDanfeScreen: React.FC<ImportacaoDanfeProps> = ({ 
  onVoltarCadastro, 
  onProcessarSucesso 
}) => {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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

  // Processa somente a importação por imagem, que é o fluxo implementado de ponta a ponta.
  // XML/chave será reativado quando houver integração fiscal real no backend.
  const handleProcessar = async () => {
    setErro(null);
    setIsProcessing(true);

    try {
      if (!arquivo) {
        throw new Error('Selecione uma foto ou arquivo da nota fiscal.');
      }

      let resultadoApi: any = null;
      {
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
          if (!resp.ok) {
            const erroApi = await resp.json().catch(() => null);
            throw new Error(erroApi?.mensagem || erroApi?.error || 'Não foi possível processar a DANFE.');
          }
          resultadoApi = await resp.json();
          if (resultadoApi?.erro) {
            throw new Error(resultadoApi.mensagem || 'A imagem não pôde ser lida como DANFE.');
          }
        } catch (apiErr: any) {
          throw new Error(apiErr?.message || 'Falha ao processar a DANFE.');
        }
      }

      if (!resultadoApi) {
        throw new Error('A DANFE não retornou dados para conferência.');
      }

      if (onProcessarSucesso) {
        onProcessarSucesso({ modo: 'imagem', arquivo, dadosExtraidos: resultadoApi });
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
        
        <div className="px-6 pt-6">
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Importe uma foto legível da DANFE. Importação por XML/chave será disponibilizada quando a integração fiscal estiver concluída.
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          
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
