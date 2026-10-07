import React, { useState, useEffect, useRef } from 'react';
import { Share2, Copy, Image as ImageIcon, X, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export interface PromocaoInfo {
  id: string;
  produtoNome: string;
  precoAntigo: number;
  precoNovo: number;
  percentual: number;
  fim: string;
  unidade?: string;
}

interface DivulgacaoModalProps {
  promocoes: PromocaoInfo[];
  onClose: () => void;
  tipo: 'unica' | 'todas';
}

export const DivulgacaoModal: React.FC<DivulgacaoModalProps> = ({ promocoes, onClose, tipo }) => {
  const { empresaId } = useAuth();
  const [mensagem, setMensagem] = useState('');
  const [copiado, setCopiado] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nomeLoja, setNomeLoja] = useState('Sua Loja');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (empresaId) {
      supabase.from('empresa').select('nome').eq('id', empresaId).single().then(({ data }) => {
        if (data) setNomeLoja(data.nome);
      });
    }
  }, [empresaId]);

  useEffect(() => {
    let texto = `*OFERTA*\n\n`;
    
    promocoes.forEach(p => {
      const precoAntigoRounded = Math.round(p.precoAntigo * 100) / 100;
      const precoNovoRounded = Math.round(p.precoNovo * 100) / 100;
      const economiaValor = Math.round((precoAntigoRounded - precoNovoRounded) * 100) / 100;
      
      const pNovo = precoNovoRounded.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const pAntigo = precoAntigoRounded.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const economiaStr = economiaValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      
      const dFim = parseISO(p.fim);
      const dataExtenso = format(dFim, "EEEE, dd/MM", { locale: ptBR });
      
      texto += `*${p.produtoNome}*\n`;
      texto += `De ~${pAntigo}~ por *${pNovo}*\n`;
      texto += `Economize ${economiaStr} (${p.percentual}% off)\n\n`;
      
      if (promocoes.length === 1) {
         texto += `Só até ${dataExtenso}\n\n`;
      } else {
         texto += `Até ${dataExtenso}\n\n`;
      }
    });

    texto += `Passe no ${nomeLoja} e aproveite!`;
    setMensagem(texto);
  }, [promocoes, nomeLoja]);

  const desenharCartaz = () => {
    const promo = promocoes[0];
    if (!promo || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fundo
    ctx.fillStyle = '#F7F4EC';
    ctx.fillRect(0, 0, 1080, 1080);

    // Faixa Superior
    ctx.fillStyle = '#0A5C3B';
    ctx.fillRect(0, 0, 1080, 170);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 92px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Simulate letter spacing
    const textOferta = "OFERTA";
    const letterSpacing = 8;
    let totalWidth = 0;
    for (let i = 0; i < textOferta.length; i++) {
        totalWidth += ctx.measureText(textOferta[i]).width + letterSpacing;
    }
    totalWidth -= letterSpacing; // remove last spacing
    
    let startX = (1080 - totalWidth) / 2;
    for (let i = 0; i < textOferta.length; i++) {
        const charWidth = ctx.measureText(textOferta[i]).width;
        ctx.fillText(textOferta[i], startX + charWidth/2, 85); // 170/2 = 85
        startX += charWidth + letterSpacing;
    }

    // Nome do produto
    ctx.fillStyle = '#14211C';
    ctx.textAlign = 'center';
    
    const wrapText = (context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, maxLines: number) => {
        let fontSize = 64;
        context.font = `bold ${fontSize}px sans-serif`;
        
        let words = text.split(' ');
        let line = '';
        let lines = [];
        
        // Auto-scale down if it takes more than 2 lines
        while (fontSize > 30) {
            lines = [];
            line = '';
            for(let n = 0; n < words.length; n++) {
                let testLine = line + words[n] + ' ';
                let metrics = context.measureText(testLine);
                if (metrics.width > maxWidth && n > 0) {
                    lines.push(line);
                    line = words[n] + ' ';
                } else {
                    line = testLine;
                }
            }
            lines.push(line);
            
            if (lines.length <= maxLines) {
                break;
            }
            fontSize -= 4;
            context.font = `bold ${fontSize}px sans-serif`;
        }
        
        let currentY = y;
        const lineHeight = fontSize * 1.2;
        
        for (let i = 0; i < lines.length; i++) {
            context.fillText(lines[i].trim(), x, currentY);
            currentY += lineHeight;
        }
        return currentY;
    }
    
    // Nome do produto
    const productEndY = wrapText(ctx, promo.produtoNome, 540, 270, 940, 2);

    const precoAntigoRounded = Math.round(promo.precoAntigo * 100) / 100;
    const precoNovoRounded = Math.round(promo.precoNovo * 100) / 100;

    // Preço Antigo
    const yPrecoAntigo = productEndY + 60;
    const pAntigo = precoAntigoRounded.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    let unidadeTexto = '';
    if (promo.unidade) {
        if (['KG', 'kg', 'Kg'].includes(promo.unidade.trim())) unidadeTexto = ' o quilo';
        else if (['UN', 'un', 'Un'].includes(promo.unidade.trim())) unidadeTexto = ' a unidade';
        else unidadeTexto = ` a ${promo.unidade.toLowerCase()}`;
    }
    
    ctx.font = 'bold 46px sans-serif';
    ctx.fillStyle = '#C4361A';
    ctx.textAlign = 'center';
    
    const pAntigoMetrics = ctx.measureText(`De ${pAntigo}`);
    const unidadeMetrics = ctx.measureText(unidadeTexto);
    const totalAntigoWidth = pAntigoMetrics.width + unidadeMetrics.width;
    
    ctx.textAlign = 'left';
    const startAntigoX = 540 - (totalAntigoWidth / 2);
    ctx.fillText(`De ${pAntigo}`, startAntigoX, yPrecoAntigo);
    
    // Risco
    ctx.fillRect(startAntigoX - 5, yPrecoAntigo - 15, pAntigoMetrics.width + 10, 5);
    
    // Unidade text
    ctx.font = '46px sans-serif';
    ctx.fillStyle = '#555555';
    ctx.fillText(unidadeTexto, startAntigoX + pAntigoMetrics.width, yPrecoAntigo);
    
    // Preço Novo
    const yPrecoNovo = yPrecoAntigo + 190;
    const pNovo = precoNovoRounded.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    ctx.font = '900 190px sans-serif';
    ctx.fillStyle = '#0A5C3B';
    ctx.textAlign = 'center';
    ctx.fillText(pNovo, 540, yPrecoNovo);

    // Selo de desconto
    const badgeX = 540 + ctx.measureText(pNovo).width / 2 + 110;
    const badgeY = yPrecoNovo - 90;
    
    ctx.save();
    ctx.translate(badgeX, badgeY);
    ctx.rotate(15 * Math.PI / 180);
    
    // Circle
    ctx.beginPath();
    ctx.arc(0, 0, 90, 0, 2 * Math.PI);
    ctx.fillStyle = '#C4361A';
    ctx.fill();
    
    // Text inside badge
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 36px sans-serif';
    ctx.fillText(`${promo.percentual}%`, 0, -15);
    ctx.fillText(`OFF`, 0, 20);
    ctx.restore();

    // Validade
    const dFim = parseISO(promo.fim);
    const dataExtenso = format(dFim, "EEEE, dd/MM", { locale: ptBR });
    ctx.fillStyle = '#444444';
    ctx.font = 'bold 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`Válido até ${dataExtenso}`, 540, 890);

    // Rodapé
    ctx.fillStyle = '#0A5C3B';
    ctx.fillRect(0, 950, 1080, 130);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nomeLoja.toUpperCase(), 540, 1015);

    setPreviewUrl(canvas.toDataURL('image/png'));
  };

  useEffect(() => {
    // Generate preview when modal opens
    if (promocoes.length > 0) {
      setTimeout(desenharCartaz, 100);
    }
  }, [promocoes, nomeLoja]);

  const abrirWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
  };

  const copiarTexto = async () => {
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const baixarCartaz = () => {
    if (!previewUrl) return;
    const promo = promocoes[0];
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = `oferta-${promo.produtoNome.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden mt-8 mb-8 flex flex-col md:flex-row">
        
        {/* Painel Esquerdo: Texto WhatsApp */}
        <div className="flex-1 p-6 border-b md:border-b-0 md:border-r border-[#14211C]/10 flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[#14211C] flex items-center gap-2">
                <Share2 className="w-5 h-5 text-[#0A5C3B]" />
                Divulgar no WhatsApp
                </h2>
                <button 
                onClick={onClose}
                className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-[#14211C]/60 hover:bg-[#14211C]/5"
                >
                <X className="w-5 h-5" />
                </button>
            </div>
            
            <div className="flex-1 flex flex-col min-h-[300px]">
                <label className="block text-sm font-bold text-[#14211C] mb-2">Mensagem para o WhatsApp</label>
                <textarea
                className="w-full flex-1 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-[#14211C] resize-none focus:outline-none focus:ring-2 focus:ring-[#0A5C3B]/20 focus:border-[#0A5C3B] transition-all"
                value={mensagem}
                onChange={e => setMensagem(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-2 mb-4">Você pode editar o texto acima antes de enviar.</p>
                
                <div className="grid grid-cols-2 gap-3 mt-auto">
                    <button
                        onClick={abrirWhatsApp}
                        className="col-span-2 bg-[#25D366] hover:bg-[#1DA851] text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm shadow-[#25D366]/20"
                    >
                        <Share2 className="w-5 h-5" />
                        Enviar no WhatsApp
                    </button>
                    
                    <button
                        onClick={copiarTexto}
                        className={`col-span-2 py-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition-colors ${
                        copiado 
                        ? 'bg-[#0A5C3B]/10 border-[#0A5C3B]/20 text-[#0A5C3B]' 
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        {copiado ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copiado ? 'Copiado!' : 'Copiar texto'}
                    </button>
                </div>
            </div>
        </div>

        {/* Painel Direito: Cartaz */}
        <div className="w-full md:w-[400px] bg-gray-50 p-6 flex flex-col items-center justify-center">
             <div className="w-full flex items-center justify-between mb-4">
                 <h2 className="text-lg font-bold text-[#14211C]">Cartaz Promocional</h2>
                 <button 
                onClick={onClose}
                className="hidden md:flex w-8 h-8 items-center justify-center rounded-lg text-[#14211C]/60 hover:bg-[#14211C]/5"
                >
                <X className="w-5 h-5" />
                </button>
             </div>
             
             {previewUrl ? (
                 <img src={previewUrl} alt="Preview do Cartaz" className="w-full h-auto rounded-xl border border-gray-200 shadow-sm mb-4" />
             ) : (
                 <div className="w-full aspect-square bg-gray-200 rounded-xl mb-4 animate-pulse flex items-center justify-center text-gray-400">
                     Gerando cartaz...
                 </div>
             )}

             <button
                onClick={baixarCartaz}
                disabled={!previewUrl || promocoes.length !== 1}
                className="w-full bg-[#14211C] hover:bg-black text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <ImageIcon className="w-4 h-4" />
                {promocoes.length === 1 ? 'Baixar Imagem (PNG)' : 'Cartaz disp. para 1 oferta'}
              </button>
        </div>

      </div>
      
      {/* Hidden canvas for drawing the poster */}
      <canvas ref={canvasRef} width="1080" height="1080" style={{ display: 'none' }}></canvas>
    </div>
  );
};
