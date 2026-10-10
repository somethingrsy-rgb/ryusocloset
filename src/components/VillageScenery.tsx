import { useId } from 'react'

const ROOFS = ['#cf8590', '#70aab2', '#729c7b', '#c58fa5', '#a487b1', '#9c9ac7', '#ca879e', '#beaa70', '#799e95', '#91a8bf']

function Tree({ x, y, size = 1, winter = false }: { x: number; y: number; size?: number; winter?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <ellipse cy="6" rx="54" ry="13" fill="#557e5630" />
      <path d="M-9 0L-7-88H9L12 0Z" fill="#997657" />
      <path d="M0-30L-24-64M1-49L23-79" fill="none" stroke="#997657" strokeWidth="9" strokeLinecap="round" />
      <path d="M-55-83C-85-99-69-148-39-154C-37-185 15-193 35-158C76-165 90-110 60-88C64-60-34-52-55-83Z" fill={winter ? '#c6dfd8' : '#91ad77'} stroke="#71865c" strokeWidth="2.5" />
      <path d="M-51-111C-62-133-41-155-21-154C-11-183 28-172 35-148C62-147 66-121 52-111C22-130-11-111-51-111Z" fill={winter ? '#f0f7ee' : '#a7cd93'} />
      <path d="M-3-6L-1-78M5-6L5-39M-7-48L-26-75M7-55L24-86" stroke="#785c43" strokeWidth="2" fill="none" opacity=".5" />
      <g fill="#637d51" opacity=".55">{Array.from({ length: 12 }, (_, k) => <ellipse key={k} cx={-44 + (k * 23) % 94} cy={-86 - (k * 19) % 66} rx="3" ry="5" transform={`rotate(${k * 31} ${-44 + (k * 23) % 94} ${-86 - (k * 19) % 66})`} />)}</g>
      {!winter && <><circle cx="-32" cy="-122" r="6" fill="#eab5b0" /><circle cx="22" cy="-148" r="5" fill="#f2c6b8" /><circle cx="42" cy="-100" r="6" fill="#eab5b0" /></>}
    </g>
  )
}

function Pine({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${size})`}>
    <path d="M-5 0V-65H5V0" fill="#947657" />
    <path d="M0-150L-29-108H-17L-43-70H-27L-55-28Q0-9 55-28L27-70H43L17-108H29Z" fill="#829970" stroke="#71865d" strokeWidth="2" strokeLinejoin="round" />
    <path d="M0-145L-22-109L0-114L-30-73L0-81L-39-34" fill="#a9bc89" opacity=".6" />
  </g>
}

function Flowers({ x, y, color }: { x: number; y: number; color: string }) {
  return <g transform={`translate(${x} ${y})`}>
    <ellipse cy="4" rx="33" ry="9" fill="#6e9c6233" />
    {[-20, 0, 20].map((offset, i) => <g key={offset} transform={`translate(${offset} ${i % 2 ? -7 : 0})`}>
      <path d="M0 0V-20M0-7Q-13-17-12-6M0-5Q13-15 12-5" stroke="#6d995c" strokeWidth="3" fill="#8cba73" />
      <circle cy="-23" r="8" fill={color} /><circle cy="-23" r="3" fill="#fff0bd" />
    </g>)}
  </g>
}

export function VillageScenery({ zone }: { zone: number }) {
  const id = useId()
  const winter = zone === 9
  const flowers = ROOFS[zone % ROOFS.length]
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1500 800" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x2="0" y2="1">
          <stop stopColor={winter ? '#deebf2' : '#c6e4ee'} />
          <stop offset="1" stopColor="#f9f2df" />
        </linearGradient>
        <linearGradient id={`${id}-earth`} x2="0" y2="1">
          <stop stopColor="#e3cd9d" /><stop offset=".5" stopColor="#e9d8b0" /><stop offset="1" stopColor="#cbae80" />
        </linearGradient>
        <filter id={`${id}-paper`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".48" numOctaves="3" seed="7" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer><feFuncA type="linear" slope=".055" /></feComponentTransfer>
          <feBlend in="SourceGraphic" mode="multiply" />
        </filter>
      </defs>
      <path d="M0 0H1500V800H0Z" fill={`url(#${id})`} />
      <g fill="#fffdf3" opacity=".75">
        <path d="M165 159C124 157 128 125 155 119C154 86 207 78 224 111C256 97 281 122 272 145C309 148 307 170 271 170H174Z" />
        <path d="M1060 211C1020 209 1026 183 1052 178C1050 146 1099 140 1116 169C1150 153 1172 177 1162 197C1195 199 1195 220 1160 220H1070Z" />
      </g>
      <path d="M0 458L160 374L283 425L432 327L610 439L779 360L947 436L1131 334L1326 419L1500 359V620H0Z" fill="#b4c7b0" />
      <path d="M0 502L226 429L355 469L580 390L812 490L1030 418L1263 478L1500 414V638H0Z" fill="#c5d4b0" />
      <g opacity=".65">{Array.from({ length: 16 }, (_, k) => <Pine key={k} x={k * 103 + 12} y={510 + (k * 17) % 32} size={.44 + (k % 4) * .12} />)}</g>
      <path d="M0 430Q150 352 310 428T640 414T990 429T1310 410Q1415 374 1500 416V800H0Z" fill={winter ? '#c1d6d1' : '#b7cfa1'} />
      <path d="M0 483Q190 418 400 467T800 459T1200 473Q1385 430 1500 474V800H0Z" fill={winter ? '#d6e5db' : '#9fbd83'} />
      <path d="M0 526Q230 493 480 521T990 520T1500 524V800H0Z" fill={winter ? '#eaf0de' : '#bed399'} />
      <g opacity=".35" fill={winter ? '#b8cbb0' : '#90b276'}>
        {Array.from({length:35}, (_, k) => <path key={k} d={`M${18+k*43} ${553+(k*37)%230}l4-6 4 6 4-4`} stroke="currentColor" strokeWidth="2" fill="none" style={{color:winter ? '#b8cbb0' : '#90b276'}} />)}
      </g>
      {/* Identical horizontal endpoint tangents keep every chunk connected. */}
      <path d="M0 710C250 710 250 672 500 690S1000 742 1250 710Q1375 710 1500 710" fill="none" stroke="#91ad7770" strokeWidth="110" />
      <path d="M0 710C250 710 250 672 500 690S1000 742 1250 710Q1375 710 1500 710" fill="none" stroke="#f4e5c1" strokeWidth="100" />
      <path d="M0 710C250 710 250 672 500 690S1000 742 1250 710Q1375 710 1500 710" fill="none" stroke={`url(#${id}-earth)`} strokeWidth="84" />
      <path d="M700 634V726" fill="none" stroke="#f4e5c1" strokeWidth="72" />
      <path d="M700 634V726" fill="none" stroke={`url(#${id}-earth)`} strokeWidth="56" />
      {/* Stepping stones guide the player from the main lane to the doorway. */}
      {[645, 665, 686, 706].map((y, k) => <g key={y}>
        <ellipse cx={699 + (k % 2 ? 5 : -4)} cy={y + 3} rx="23" ry="7" fill="#a48e69" opacity=".35" />
        <path d={`M${677 + (k % 2 ? 5 : -4)} ${y}q-4-8 12-10l25 2q12 7-1 13l-26 1Z`} fill="#e9e1c7" stroke="#b9aa8d" strokeWidth="2" />
      </g>)}
      <g stroke="#aa936c" strokeWidth="1.2" fill="#e9dfc6" opacity=".9">
        {Array.from({ length: 50 }, (_, k) => {
          const x = k * 31 + 5
          const y = 710 - 22 * Math.sin(x / 1500 * Math.PI * 2)
          return <ellipse key={k} cx={x} cy={y + (k % 2 ? 43 : -43)} rx={4 + k % 4} ry={2 + k % 2} />
        })}
      </g>
      <g fill="#7e9e63" opacity=".65">
        {Array.from({ length: 64 }, (_, k) => { const x = k * 24; const y = 710 - 22 * Math.sin(x / 1500 * Math.PI * 2) + (k % 2 ? 61 : -61); return <path key={k} d={`M${x} ${y}q-8-15-7-18q8 5 8 12q2-17 5-19q4 10-1 22q9-12 13-9q-1 9-12 12Z`} /> })}
      </g>
      <g fill="#f1dfbb" opacity=".8">
        {Array.from({length:20}, (_, k) => <ellipse key={k} cx={k*76+14} cy={700+Math.sin(k*.7)*15} rx="4" ry="2" />)}
      </g>
      <Pine x={65} y={555} size={1.2} /><Pine x={1450} y={574} size={1.35} />
      <Tree x={36} y={495} size={1.65} winter={winter} />
      <Tree x={1470} y={486} size={1.7} winter={winter} />
      <Tree x={140} y={565} size={1.12} winter={winter} />
      <Tree x={374} y={582} size={.9} winter={winter} />
      <Tree x={1035} y={580} size={1.05} winter={winter} />
      <Tree x={1330} y={561} size={.85} winter={winter} />
      <g fill="#8caf73">
        <ellipse cx="520" cy="596" rx="63" ry="25" /><ellipse cx="885" cy="596" rx="60" ry="24" />
      </g>
      <Flowers x={488} y={636} color={flowers} /><Flowers x={917} y={631} color={flowers} />
      <Flowers x={220} y={635} color="#e7b5a9" /><Flowers x={1200} y={650} color="#fff3ca" />
      <Flowers x={420} y={790} color={flowers} /><Flowers x={1000} y={794} color="#fff3ca" />
      <g fill="#fff2cd" opacity=".85">{Array.from({ length: 38 }, (_, k) => <g key={k} transform={`translate(${23 + k * 39} ${573 + (k * 47) % 89})`}><path d="M-5 0H5M0-5V5" stroke="#f8f0d7" strokeWidth="4" strokeLinecap="round" /><circle r="2" fill="#dbb46c" /></g>)}</g>
      {/* A low garden fence and a lantern beside the approach. */}
      <g stroke="#f7edd5" strokeWidth="10" strokeLinecap="round">
        <path d="M434 591H554M434 615H554M442 581V627M478 581V627M514 581V627M550 581V627" />
        <path d="M838 591H958M838 615H958M844 581V627M880 581V627M916 581V627M952 581V627" />
      </g>
      <g transform="translate(812 669)">
        <ellipse cy="3" rx="20" ry="6" fill="#557e5630" />
        <path d="M0 0V-93" stroke="#7c8171" strokeWidth="7" />
        <path d="M-14-89H14L10-116H-10Z" fill="#fff0bb" stroke="#7c8171" strokeWidth="4" />
        <path d="M-18-119L0-132L18-119Z" fill="#7c8171" />
      </g>
      <g transform="translate(1120 612)">
        <path d="M-44 8V34M44 8V34" stroke="#7c8171" strokeWidth="6" />
        <path d="M-53-19H53M-53-6H53M-57 9H57" stroke="#b89069" strokeWidth="10" strokeLinecap="round" />
      </g>
      <rect width="1500" height="800" fill="transparent" filter={`url(#${id}-paper)`} />
    </svg>
  )
}

export function VillageHouse({ zone, icon }: { zone: number; icon: string }) {
  const roof = ROOFS[zone % ROOFS.length]
  return <svg aria-hidden viewBox="0 0 280 280" className="h-[280px] w-[280px]">
    <ellipse cx="140" cy="259" rx="119" ry="15" fill="#557e5630" />
    <path d="M51 122H230V249Q140 270 51 249Z" fill="#fff2d8" stroke="#dfc7a4" strokeWidth="4" />
    <path d="M202 63V26H224V94" fill="#dbb99c" stroke="#bc9578" strokeWidth="4" />
    <path d="M27 130L135 41Q140 37 145 41L253 130Q256 139 246 139H34Q24 139 27 130Z" fill={roof} stroke="#ffffff90" strokeWidth="5" />
    <path d="M45 123L140 52L235 123" fill="none" stroke="#ffffff35" strokeWidth="6" strokeLinecap="round" />
    <path d="M119 250V181Q140 151 162 181V250" fill="#ad896a" stroke="#876b57" strokeWidth="4" />
    <circle cx="151" cy="214" r="4" fill="#f2d897" />
    <g stroke="#c1a786" strokeWidth="5" fill="#b8d8d4">
      <rect x="69" y="163" width="35" height="41" rx="8" />
      <rect x="178" y="163" width="35" height="41" rx="8" />
      <path d="M86 164V203M69 184H104M195 164V203M179 184H212" fill="none" />
    </g>
    <path d="M111 254H170" stroke="#d9bf9c" strokeWidth="11" strokeLinecap="round" />
    <text x="140" y="123" textAnchor="middle" fontSize="31">{icon}</text>
    <g fill="#92b77a"><ellipse cx="61" cy="242" rx="27" ry="16" /><ellipse cx="218" cy="242" rx="24" ry="16" /></g>
    <g fill="#eab5b0"><circle cx="54" cy="236" r="5" /><circle cx="69" cy="241" r="5" /><circle cx="216" cy="234" r="5" /></g>
  </svg>
}
