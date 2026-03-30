'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload,
  Plus,
  Trash2,
  Download,
  Loader2,
  MousePointer2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useLeaderboardTemplates,
  useCreateLeaderboardTemplate,
  useUpdateLeaderboardTemplate,
  useDeleteLeaderboardTemplate,
} from '@/hooks/use-leaderboard-template';
import { leaderboardApi } from '@/lib/api';
import type { LeaderboardTemplateDto, TextPosition } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageLoader } from '@/components/common/loading-spinner';
import { PageHeader } from '@/components/common/page-header';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  name: string;
  points: number;
}

// ─── Font options ─────────────────────────────────────────────────────────────

interface FontOption {
  label: string;
  value: string;
  google?: boolean;
}

const FONT_OPTIONS: FontOption[] = [
  // System fonts
  { label: 'Arial', value: 'Arial' },
  { label: 'Arial Black', value: 'Arial Black' },
  { label: 'Impact', value: 'Impact' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Verdana', value: 'Verdana' },
  { label: 'Tahoma', value: 'Tahoma' },
  { label: 'Courier New', value: 'Courier New' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  // Google Fonts
  { label: 'Roboto', value: 'Roboto', google: true },
  { label: 'Open Sans', value: 'Open Sans', google: true },
  { label: 'Lato', value: 'Lato', google: true },
  { label: 'Montserrat', value: 'Montserrat', google: true },
  { label: 'Oswald', value: 'Oswald', google: true },
  { label: 'Raleway', value: 'Raleway', google: true },
  { label: 'Poppins', value: 'Poppins', google: true },
  { label: 'Bebas Neue', value: 'Bebas Neue', google: true },
  { label: 'Anton', value: 'Anton', google: true },
  { label: 'Orbitron', value: 'Orbitron', google: true },
  { label: 'Playfair Display', value: 'Playfair Display', google: true },
  { label: 'Dancing Script', value: 'Dancing Script', google: true },
  { label: 'Exo 2', value: 'Exo 2', google: true },
  { label: 'Russo One', value: 'Russo One', google: true },
];

const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Roboto&family=Open+Sans&family=Lato&family=Montserrat&family=Oswald&family=Raleway&family=Poppins&family=Bebas+Neue&family=Anton&family=Orbitron&family=Playfair+Display&family=Dancing+Script&family=Exo+2&family=Russo+One&display=swap';

// ─── Constants ────────────────────────────────────────────────────────────────

const RANK_COLORS = [
  '#FFD700', '#C0C0C0', '#CD7F32', '#60A5FA', '#34D399',
  '#F87171', '#A78BFA', '#FB923C', '#22D3EE', '#E879F9',
];

const DEFAULT_POSITION: Omit<TextPosition, 'rank'> = {
  x: 100,
  y: 100,
  fontSize: 32,
  color: '#FFFFFF',
  bold: false,
  align: 'center',
  fontFamily: 'Arial',
};

const MARKER_RADIUS = 14;

function rankColor(rank: number): string {
  return RANK_COLORS[(rank - 1) % RANK_COLORS.length] ?? '#60A5FA';
}
function rankLabel(rank: number): string {
  return `${rank}°`;
}
function sampleName(rank: number): string {
  const names = ['Mario Rossi', 'Luigi Verdi', 'Anna Bianchi', 'Carlo Neri', 'Sofia Bruno',
                 'Marco Russo', 'Giulia Esposito', 'Luca Romano', 'Elena Conti', 'Paolo Ricci'];
  return names[(rank - 1) % names.length] ?? `Utente ${rank}`;
}

// ─── Canvas renderer ──────────────────────────────────────────────────────────

function drawCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  positions: TextPosition[],
  selectedRank: number | null,
  entries: LeaderboardEntry[],
  showMarkers = true,
) {
  // Only resize when dimensions change — avoids canvas reset flash on every keystroke
  if (canvas.width !== image.naturalWidth || canvas.height !== image.naturalHeight) {
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Background image
  ctx.drawImage(image, 0, 0);

  // 2. Text at each position (final output, no markers)
  for (const pos of positions) {
    const entry = entries.find(e => e.rank === pos.rank);
    const text = entry?.name ?? sampleName(pos.rank);

    ctx.save();
    const family = pos.fontFamily ? `"${pos.fontFamily}", Arial, sans-serif` : 'Arial, sans-serif';
    ctx.font = `${pos.bold ? 'bold ' : ''}${pos.fontSize}px ${family}`;
    ctx.fillStyle = pos.color;
    ctx.textAlign = pos.align as CanvasTextAlign;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pos.x, pos.y);
    ctx.restore();
  }

  if (!showMarkers) return;

  // 3. Rank markers (editing aid only — not rendered on download)
  for (const pos of positions) {
    const isSelected = pos.rank === selectedRank;
    const r = isSelected ? MARKER_RADIUS + 4 : MARKER_RADIUS;
    const color = rankColor(pos.rank);

    ctx.save();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;

    if (isSelected) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.font = `bold ${isSelected ? 14 : 11}px Arial, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(pos.rank), pos.x, pos.y);
    ctx.restore();
  }
}

// ─── Canvas editor component ──────────────────────────────────────────────────

interface CanvasEditorProps {
  imageUrl: string;
  positions: TextPosition[];
  selectedRank: number | null;
  entries: LeaderboardEntry[];
  onPlace: (x: number, y: number) => void;
  onMove: (rank: number, x: number, y: number) => void;
  onSelect: (rank: number) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  imageRef: React.RefObject<HTMLImageElement | null>;
}

function CanvasEditor({ imageUrl, positions, selectedRank, entries, onPlace, onMove, onSelect, canvasRef, imageRef }: CanvasEditorProps) {
  const dragRef = useRef<{ rank: number } | null>(null);
  const didDragRef = useRef(false);
  const [cursor, setCursor] = useState<'crosshair' | 'grab' | 'grabbing'>('crosshair');

  function getScale() {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 1, y: 1 };
    const rect = canvas.getBoundingClientRect();
    return { x: canvas.width / rect.width, y: canvas.height / rect.height };
  }

  function canvasCoords(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scale = getScale();
    return {
      x: Math.round((e.clientX - rect.left) * scale.x),
      y: Math.round((e.clientY - rect.top) * scale.y),
    };
  }

  function hitMarker(cx: number, cy: number): number | null {
    for (const pos of positions) {
      const dx = pos.x - cx;
      const dy = pos.y - cy;
      if (Math.sqrt(dx * dx + dy * dy) <= MARKER_RADIUS + 8) return pos.rank;
    }
    return null;
  }

  // Inject Google Fonts once and redraw after fonts ready
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const id = 'leaderboard-gfonts';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = GOOGLE_FONTS_URL;
      document.head.appendChild(link);
    }
    document.fonts.ready.then(() => {
      const img = imageRef.current;
      if (img && canvasRef.current) {
        drawCanvas(canvasRef.current, img, positions, selectedRank, entries);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload image when URL changes
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      if (canvasRef.current) {
        drawCanvas(canvasRef.current, img, positions, selectedRank, entries);
      }
    };
    img.src = imageUrl;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  // Redraw on any data change (real-time)
  useEffect(() => {
    const img = imageRef.current;
    if (img && canvasRef.current) {
      drawCanvas(canvasRef.current, img, positions, selectedRank, entries);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, selectedRank, entries]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = canvasCoords(e);
    const hit = hitMarker(x, y);
    if (hit !== null) {
      dragRef.current = { rank: hit };
      didDragRef.current = false;
      onSelect(hit);
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      setCursor('grabbing');
      e.preventDefault();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, onSelect]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = canvasCoords(e);
    if (dragRef.current) {
      didDragRef.current = true;
      onMove(dragRef.current.rank, x, y);
    } else {
      const hit = hitMarker(x, y);
      setCursor(hit !== null ? 'grab' : 'crosshair');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, onMove]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      dragRef.current = null;
      setCursor('grab');
      return;
    }
    // Plain click (no drag) → place selected rank
    if (!didDragRef.current) {
      const { x, y } = canvasCoords(e);
      if (hitMarker(x, y) === null) {
        onPlace(x, y);
      }
    }
    didDragRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, onPlace]);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => { dragRef.current = null; setCursor('crosshair'); }}
      className="block max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm touch-none"
      style={{ imageRendering: 'auto', cursor }}
    />
  );
}

// ─── Position row ─────────────────────────────────────────────────────────────

interface PositionRowProps {
  pos: TextPosition;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updated: TextPosition) => void;
  onDelete: () => void;
}

function PositionRow({ pos, isSelected, onSelect, onChange, onDelete }: PositionRowProps) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        'rounded-lg border p-3 cursor-pointer transition-colors space-y-3',
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shrink-0"
            style={{ backgroundColor: rankColor(pos.rank) }}
          >
            {pos.rank}
          </span>
          <span className="text-sm font-semibold text-slate-700">{rankLabel(pos.rank)} posto</span>
        </div>
        <div className="flex items-center gap-1">
          {isSelected && (
            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 border-0 mr-1">
              selezionato
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">X (px)</Label>
          <Input type="number" value={pos.x}
            onChange={(e) => onChange({ ...pos, x: Number(e.target.value) })}
            className="h-7 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Y (px)</Label>
          <Input type="number" value={pos.y}
            onChange={(e) => onChange({ ...pos, y: Number(e.target.value) })}
            className="h-7 text-xs" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Font (px)</Label>
          <Input type="number" value={pos.fontSize} min={8} max={300}
            onChange={(e) => onChange({ ...pos, fontSize: Number(e.target.value) })}
            className="h-7 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Colore</Label>
          <div className="flex items-center gap-1.5">
            <input type="color" value={pos.color}
              onChange={(e) => onChange({ ...pos, color: e.target.value })}
              className="h-7 w-10 cursor-pointer rounded border border-slate-200 p-0.5 bg-white" />
            <Input value={pos.color}
              onChange={(e) => onChange({ ...pos, color: e.target.value })}
              className="h-7 text-xs font-mono flex-1" maxLength={7} />
          </div>
        </div>
      </div>

      <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
        <Label className="text-xs text-slate-500">Font</Label>
        <Select value={pos.fontFamily ?? 'Arial'} onValueChange={(v) => onChange({ ...pos, fontFamily: v })}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__system" disabled className="text-xs font-semibold text-slate-400 pointer-events-none">
              — Sistema —
            </SelectItem>
            {FONT_OPTIONS.filter((f) => !f.google).map((f) => (
              <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }} className="text-xs">
                {f.label}
              </SelectItem>
            ))}
            <SelectItem value="__google" disabled className="text-xs font-semibold text-slate-400 pointer-events-none">
              — Google Fonts —
            </SelectItem>
            {FONT_OPTIONS.filter((f) => f.google).map((f) => (
              <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }} className="text-xs">
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          <Switch checked={pos.bold} onCheckedChange={(v) => onChange({ ...pos, bold: v })} className="scale-75" />
          <Label className="text-xs text-slate-500 cursor-pointer">Grassetto</Label>
        </div>
        <div className="flex-1 space-y-1">
          <Select value={pos.align} onValueChange={(v) => onChange({ ...pos, align: v as TextPosition['align'] })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Sinistra</SelectItem>
              <SelectItem value="center">Centro</SelectItem>
              <SelectItem value="right">Destra</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LeaderboardTemplateContent() {
  const { data: templates, isLoading } = useLeaderboardTemplates();
  const createTemplate = useCreateLeaderboardTemplate();
  const updateTemplate = useUpdateLeaderboardTemplate();
  const deleteTemplate = useDeleteLeaderboardTemplate();

  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [localName, setLocalName] = useState('');
  const [localPositions, setLocalPositions] = useState<TextPosition[]>([]);
  const [localIsActive, setLocalIsActive] = useState(false);
  const [selectedRank, setSelectedRank] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('Nuova Classifica');
  const [isDownloading, setIsDownloading] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);

  // Global style defaults applied when creating new positions
  const [defaultStyle, setDefaultStyle] = useState<Omit<TextPosition, 'rank' | 'x' | 'y'>>({
    fontSize: DEFAULT_POSITION.fontSize,
    color: DEFAULT_POSITION.color,
    bold: DEFAULT_POSITION.bold,
    align: DEFAULT_POSITION.align,
    fontFamily: DEFAULT_POSITION.fontFamily,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const activeTemplate: LeaderboardTemplateDto | null =
    templates?.find((t) => t.id === activeTemplateId) ?? templates?.[0] ?? null;

  // Load real leaderboard data for preview
  useEffect(() => {
    leaderboardApi.get({ limit: 20 }).then((data) => {
      setLeaderboardEntries(
        data.entries.map((e) => ({
          rank: e.rank,
          name: e.firstName ?? e.telegramUsername ?? `Utente ${e.rank}`,
          points: e.totalPoints,
        })),
      );
    }).catch(() => { /* use sample names */ });
  }, []);

  // Sync local state when active template changes
  useEffect(() => {
    if (activeTemplate) {
      setActiveTemplateId(activeTemplate.id);
      setLocalName(activeTemplate.name);
      setLocalPositions(activeTemplate.positions ?? []);
      setLocalIsActive(activeTemplate.isActive);
      if (selectedRank === null && (activeTemplate.positions?.length ?? 0) === 0) {
        setSelectedRank(1);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTemplate?.id]);

  // ── File handlers ────────────────────────────────────────────────────────────

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Seleziona un file immagine (PNG o JPG)');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("L'immagine non deve superare i 50 MB");
      return;
    }
    const name = newTemplateName.trim() || file.name.replace(/\.[^.]+$/, '');
    createTemplate.mutate({ name, image: file }, {
      onSuccess: (created) => {
        setActiveTemplateId(created.id);
        setLocalName(created.name);
        setLocalPositions(created.positions ?? []);
        setLocalIsActive(created.isActive);
        setSelectedRank(1);
      },
    });
  }, [createTemplate, newTemplateName]);

  // ── Canvas click → place position ────────────────────────────────────────────

  const handleImageClick = useCallback((x: number, y: number) => {
    if (selectedRank === null) return;
    setLocalPositions((prev) => {
      const existing = prev.find((p) => p.rank === selectedRank);
      if (existing) return prev.map((p) => p.rank === selectedRank ? { ...p, x, y } : p);
      return [...prev, { ...DEFAULT_POSITION, ...defaultStyle, rank: selectedRank, x, y }];
    });
  }, [selectedRank, defaultStyle]);

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  const handleAddPosition = useCallback(() => {
    const used = new Set(localPositions.map((p) => p.rank));
    let next = 1;
    while (used.has(next)) next++;
    setLocalPositions((prev) => [...prev, { ...DEFAULT_POSITION, ...defaultStyle, rank: next, x: 100, y: 100 }]);
    setSelectedRank(next);
  }, [localPositions, defaultStyle]);

  const handleSave = useCallback(() => {
    if (!activeTemplateId) return;
    updateTemplate.mutate({ id: activeTemplateId, dto: { name: localName, isActive: localIsActive, positions: localPositions } });
  }, [activeTemplateId, localIsActive, localName, localPositions, updateTemplate]);

  const handleToggleActive = useCallback((checked: boolean) => {
    setLocalIsActive(checked);
    if (!activeTemplateId) return;
    updateTemplate.mutate({ id: activeTemplateId, dto: { isActive: checked } });
  }, [activeTemplateId, updateTemplate]);

  const handleDeleteTemplate = useCallback(() => {
    if (!activeTemplateId) return;
    deleteTemplate.mutate(activeTemplateId, {
      onSuccess: () => { setActiveTemplateId(null); setLocalPositions([]); setSelectedRank(null); },
    });
  }, [activeTemplateId, deleteTemplate]);

  // ── Position drag ──────────────────────────────────────────────────────────────

  const handlePositionMove = useCallback((rank: number, x: number, y: number) => {
    setLocalPositions((prev) => prev.map((p) => p.rank === rank ? { ...p, x, y } : p));
  }, []);

  // ── Download (offscreen canvas — no markers) ──────────────────────────────────

  const handleDownload = useCallback(() => {
    const img = imageRef.current;
    if (!img) { toast.error('Immagine non caricata'); return; }
    setIsDownloading(true);

    const offscreen = document.createElement('canvas');
    drawCanvas(offscreen, img, localPositions, null, leaderboardEntries, false);

    offscreen.toBlob((blob) => {
      setIsDownloading(false);
      if (!blob) { toast.error('Errore nella generazione del PNG'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `classifica-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }, [localPositions, leaderboardEntries]);

  const sortedPositions = [...localPositions].sort((a, b) => a.rank - b.rank);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Grafica Classifica"
        description="Configura il template grafico e scarica la classifica come PNG"
        action={
          templates && templates.length > 1 ? (
            <Select value={activeTemplateId ?? ''} onValueChange={(id) => {
              const tpl = templates.find((t) => t.id === id);
              if (!tpl) return;
              setActiveTemplateId(tpl.id);
              setLocalName(tpl.name);
              setLocalPositions(tpl.positions ?? []);
              setLocalIsActive(tpl.isActive);
              setSelectedRank(null);
            }}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Seleziona template..." /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}{t.isActive && <span className="ml-1.5 text-xs text-green-600">(attivo)</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Canvas panel */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader className="py-3 px-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-700">Canvas immagine</CardTitle>
                {activeTemplate && selectedRank !== null && (
                  <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium">
                    <MousePointer2 className="h-3.5 w-3.5" />
                    Clicca per posizionare il {rankLabel(selectedRank)} posto
                  </div>
                )}
                {activeTemplate && selectedRank === null && (
                  <p className="text-xs text-slate-400">Seleziona una posizione nel pannello a destra</p>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {!activeTemplate ? (
                <div
                  onDragEnter={() => setIsDragging(true)}
                  onDragLeave={() => setIsDragging(false)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors min-h-[400px]',
                    isDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40',
                    createTemplate.isPending && 'pointer-events-none opacity-60',
                  )}
                >
                  {createTemplate.isPending ? (
                    <><Loader2 className="h-10 w-10 text-blue-400 animate-spin" /><p className="text-sm text-slate-500">Caricamento in corso...</p></>
                  ) : (
                    <>
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                        <Upload className="h-7 w-7 text-slate-400" />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-sm font-semibold text-slate-700">Carica immagine sfondo</p>
                        <p className="text-xs text-slate-400">Trascina qui o clicca per selezionare (PNG/JPG, max 50 MB)</p>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center bg-slate-900 rounded-lg overflow-hidden min-h-[300px]">
                  <CanvasEditor
                    imageUrl={activeTemplate.imageUrl}
                    positions={localPositions}
                    selectedRank={selectedRank}
                    entries={leaderboardEntries}
                    onPlace={handleImageClick}
                    onMove={handlePositionMove}
                    onSelect={setSelectedRank}
                    canvasRef={canvasRef}
                    imageRef={imageRef}
                  />
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }} />
            </CardContent>
          </Card>

          {activeTemplate && (
            <div className="mt-3 flex items-center gap-2">
              <Input value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Nome nuovo template..." className="h-8 text-sm max-w-xs" />
              <Button variant="outline" size="sm" disabled={createTemplate.isPending}
                onClick={() => fileInputRef.current?.click()} className="h-8 text-xs">
                {createTemplate.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                Nuovo template
              </Button>
            </div>
          )}
        </div>

        {/* Config panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700">Impostazioni template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!activeTemplate ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Nome template</Label>
                    <Input value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="Es. Classifica Aprile 2026" className="text-sm" />
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                    <AlertCircle className="h-4 w-4 shrink-0 text-slate-400" />
                    Carica prima un&apos;immagine sfondo nel canvas a sinistra.
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Nome template</Label>
                    <Input value={localName} onChange={(e) => setLocalName(e.target.value)}
                      placeholder="Nome template..." className="text-sm" />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Template attivo</p>
                      <p className="text-xs text-slate-400">Usato per generare la classifica</p>
                    </div>
                    <Switch checked={localIsActive} onCheckedChange={handleToggleActive} disabled={updateTemplate.isPending} />
                  </div>

                  {localIsActive && (
                    <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Questo template verrà usato per le grafiche
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button onClick={handleSave} disabled={updateTemplate.isPending} size="sm"
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                      {updateTemplate.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                      Salva
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDeleteTemplate} disabled={deleteTemplate.isPending}
                      className="border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600">
                      {deleteTemplate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>

                  <Separator />

                  <Button variant="outline" size="sm" onClick={handleDownload} disabled={isDownloading || !activeTemplate}
                    className="w-full border-slate-200 text-slate-700 hover:bg-slate-50">
                    {isDownloading
                      ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      : <Download className="h-4 w-4 mr-2" />}
                    Scarica classifica (PNG)
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {activeTemplate && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-slate-700">Posizioni testo</CardTitle>
                  <Button size="sm" variant="outline" onClick={handleAddPosition} className="h-7 text-xs px-2">
                    <Plus className="h-3.5 w-3.5 mr-1" />Aggiungi posizione
                  </Button>
                </div>
              </CardHeader>

              {/* ── Default style toolbar ── */}
              <div className="mx-3 mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Stile predefinito</p>

                {/* Font family */}
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Font</Label>
                  <Select
                    value={defaultStyle.fontFamily}
                    onValueChange={(v) => setDefaultStyle((s) => ({ ...s, fontFamily: v }))}
                  >
                    <SelectTrigger className="h-7 text-xs bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__sys" disabled className="text-xs font-semibold text-slate-400 pointer-events-none">— Sistema —</SelectItem>
                      {FONT_OPTIONS.filter((f) => !f.google).map((f) => (
                        <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }} className="text-xs">{f.label}</SelectItem>
                      ))}
                      <SelectItem value="__goo" disabled className="text-xs font-semibold text-slate-400 pointer-events-none">— Google Fonts —</SelectItem>
                      {FONT_OPTIONS.filter((f) => f.google).map((f) => (
                        <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }} className="text-xs">{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Size + Color row */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Dimensione (px)</Label>
                    <Input
                      type="number"
                      min={8}
                      max={300}
                      value={defaultStyle.fontSize}
                      onChange={(e) => setDefaultStyle((s) => ({ ...s, fontSize: Number(e.target.value) }))}
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Colore</Label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={defaultStyle.color}
                        onChange={(e) => setDefaultStyle((s) => ({ ...s, color: e.target.value }))}
                        className="h-7 w-10 cursor-pointer rounded border border-slate-200 p-0.5 bg-white"
                      />
                      <Input
                        value={defaultStyle.color}
                        onChange={(e) => setDefaultStyle((s) => ({ ...s, color: e.target.value }))}
                        className="h-7 text-xs font-mono flex-1 bg-white"
                        maxLength={7}
                      />
                    </div>
                  </div>
                </div>

                {/* Bold + Align row */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={defaultStyle.bold}
                      onCheckedChange={(v) => setDefaultStyle((s) => ({ ...s, bold: v }))}
                      className="scale-75"
                    />
                    <Label className="text-xs text-slate-500">Grassetto</Label>
                  </div>
                  <div className="flex-1">
                    <Select
                      value={defaultStyle.align}
                      onValueChange={(v) => setDefaultStyle((s) => ({ ...s, align: v as TextPosition['align'] }))}
                    >
                      <SelectTrigger className="h-7 text-xs bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Sinistra</SelectItem>
                        <SelectItem value="center">Centro</SelectItem>
                        <SelectItem value="right">Destra</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <CardContent className="space-y-2 pt-0">
                {sortedPositions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center">
                    <MousePointer2 className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-medium">Nessuna posizione configurata</p>
                    <p className="text-xs text-slate-400 mt-1">Aggiungi una posizione e clicca sull&apos;immagine per piazzarla</p>
                  </div>
                ) : (
                  sortedPositions.map((pos) => (
                    <PositionRow key={pos.rank} pos={pos}
                      isSelected={selectedRank === pos.rank}
                      onSelect={() => setSelectedRank(pos.rank)}
                      onChange={(updated) => setLocalPositions((prev) => prev.map((p) => p.rank === updated.rank ? updated : p))}
                      onDelete={() => { setLocalPositions((prev) => prev.filter((p) => p.rank !== pos.rank)); setSelectedRank((c) => c === pos.rank ? null : c); }}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
