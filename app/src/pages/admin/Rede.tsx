export function AdminRede() {
  // Static SVG-based network diagram (mock)
  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Rede de originação</h1>
          <p className="text-sm text-silver-600">Visualização hierárquica de parceiros, equipes e propostas.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline">−</button>
          <button className="btn-outline">+</button>
          <button className="btn-outline">Centralizar</button>
        </div>
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center gap-3 border-b border-silver-100 pb-3 text-xs">
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rotate-45 bg-navy" /> Admin</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-success" /> Parceiro</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-gold" /> Equipe</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-silver-400" /> Membro</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-chart-blue" /> Proposta</span>
        </div>
        <div className="flex h-[520px] items-center justify-center overflow-hidden rounded-lg bg-silver-50">
          <svg viewBox="0 0 800 480" className="h-full w-full">
            {/* connections */}
            {[[400, 60, 200, 200], [400, 60, 400, 200], [400, 60, 600, 200],
              [200, 200, 120, 320], [200, 200, 280, 320],
              [400, 200, 380, 320], [400, 200, 460, 320],
              [600, 200, 560, 320], [600, 200, 660, 320],
              [120, 320, 80, 420], [280, 320, 320, 420],
              [380, 320, 380, 420], [560, 320, 560, 420], [660, 320, 700, 420]
            ].map(([x1, y1, x2, y2], i) => (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9CA3AF" strokeWidth="1.5" />
            ))}
            {/* admin (hexagon-like) */}
            <g transform="translate(400 60)">
              <polygon points="-30,0 -15,-26 15,-26 30,0 15,26 -15,26" fill="#0A2B4E" />
              <text textAnchor="middle" y="5" fill="#D4AF37" fontSize="10" fontWeight="bold">ADMIN</text>
            </g>
            {/* partners */}
            {[['Aurora', 200], ['Vista Sul', 400], ['Capital +', 600]].map(([name, x], i) => (
              <g key={i} transform={`translate(${x} 200)`}>
                <circle r="28" fill="#2C9A4C" />
                <text textAnchor="middle" y="-2" fill="white" fontSize="9" fontWeight="bold">{name}</text>
                <text textAnchor="middle" y="10" fill="white" fontSize="8">{12 - i * 3} props</text>
              </g>
            ))}
            {/* teams */}
            {[120, 280, 380, 460, 560, 660].map((x, i) => (
              <g key={i} transform={`translate(${x} 320)`}>
                <circle r="18" fill="#D4AF37" />
                <text textAnchor="middle" y="3" fill="#0A2B4E" fontSize="8" fontWeight="bold">EQ{i + 1}</text>
              </g>
            ))}
            {/* members and proposals */}
            {[80, 320, 380, 560, 700].map((x, i) => (
              <g key={i} transform={`translate(${x} 420)`}>
                <circle r="10" fill="#9CA3AF" />
                <rect x="14" y="-8" width="40" height="14" rx="2" fill="#2C6B9E" />
                <text x="34" y="2" textAnchor="middle" fill="white" fontSize="8">prop</text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </>
  )
}
