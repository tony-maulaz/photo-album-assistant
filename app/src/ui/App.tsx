// Composant racine : cadre de l'application et page affichée.

import { useLayoutEffect, useRef } from 'preact/hooks';
import { BandeauSource } from './composants/BandeauSource';
import { Entete, Messages } from './composants/Cadre';
import { PAGES_CADRE } from './composants/CadreCommun';
import { Dialogues } from './composants/Dialogues';
import { Raccourcis } from './composants/Raccourcis';
import { t } from '../lib/langue';
import { allerEtape, page, session, versionProjet } from './etat';
import { arborescenceValidee, CODES_ETAPES, ETAPE } from '../navigateur/projet';
import { PageAccueil, PageReprendre } from './pages/Accueil';
import { PageAlbum } from './pages/Album';
import { PageConfiguration } from './pages/Configuration';
import { PageDossiers } from './pages/Dossiers';
import { PageDoublons } from './pages/Doublons';
import { PageFloues } from './pages/Floues';
import { PageNommage } from './pages/Nommage';
import { PageConsolidation } from './pages/Organisation';
import { PagePetitsDossiers } from './pages/PetitsDossiers';
import { PageInventaire } from './pages/Inventaire';
import { PageOrganiser } from './pages/Organiser';
import { PageAide, PageFonctionsIA, PageJournal, PageReglages } from './pages/Pages';
import { PageEtape1, PageNouveauProjet } from './pages/Projet';
import { PageSelection } from './pages/Selection';
import { PageSortie } from './pages/Sortie';
import { PageTri } from './pages/Tri';

function PageEtape({ numero }: { numero: number }) {
  const s = session.value!;
  versionProjet.value;
  const code = CODES_ETAPES[numero - 1] ?? 'projet';
  if (code === 'projet') return <PageEtape1 />;
  if (code === 'inventaire' || !s.projet.inventaire) return <PageInventaire />;
  switch (code) {
    case 'dossiers':
      return <PageDossiers />;
    case 'floues':
      return <PageFloues />;
    case 'doublons':
      return <PageDoublons />;
    case 'tri':
      return <PageTri />;
    case 'lieux':
      return <PageOrganiser />;
    case 'petits':
      return <PagePetitsDossiers />;
    case 'nommage':
      return <PageNommage />;
    case 'consolidation':
      return <PageConsolidation />;
    case 'selection':
      return <PageSelection />;
    case 'album':
      return <PageAlbum />;
  }
  if (!arborescenceValidee(s.projet)) {
    return (
      <div class="page etroite">
        <h1>{t`Création de la sortie`}</h1>
        <p class="encart">{t`Validez d’abord les lieux et sorties (étape ${ETAPE.lieux}) : la sortie est écrite à partir de cette arborescence.`}</p>
        <button type="button" class="principal" onClick={() => allerEtape('lieux')}>
          {t`Aller à l’étape ${ETAPE.lieux}`}
        </button>
      </div>
    );
  }
  return <PageSortie />;
}

export function App() {
  const p = page.value;
  const s = session.value;
  const zone = useRef<HTMLElement>(null);
  // Chaque page s'ouvre en haut (titre et explication visibles), même si la précédente était défilée.
  const clePage = p.nom === 'etape' ? `etape-${p.numero}` : p.nom;
  useLayoutEffect(() => {
    zone.current?.scrollTo(0, 0);
  }, [clePage]);
  let contenu;
  switch (p.nom) {
    case 'reprendre':
      contenu = <PageReprendre />;
      break;
    case 'nouveau':
      contenu = <PageNouveauProjet mode={p.mode} />;
      break;
    case 'etape':
      contenu = s ? <PageEtape numero={p.numero} /> : <PageAccueil />;
      break;
    case 'ia':
      contenu = <PageFonctionsIA />;
      break;
    case 'configuration':
      contenu = <PageConfiguration />;
      break;
    case 'reglages':
      contenu = <PageReglages />;
      break;
    case 'journal':
      contenu = <PageJournal />;
      break;
    case 'aide':
      contenu = <PageAide />;
      break;
    default:
      contenu = <PageAccueil />;
  }
  // Cadre commun (lot 4, D111) : les pages passées au cadre ne défilent plus en entier ; les autres gardent
  // l'ancien défilement (« ancien »), en attendant leur tour.
  const code = p.nom === 'etape' && s ? CODES_ETAPES[p.numero - 1] : undefined;
  const cadre = code && PAGES_CADRE.has(code) && s?.projet.inventaire ? 'commun' : 'ancien';
  return (
    <div class={`app page-${p.nom}${p.nom === 'etape' ? ` etape-${p.numero}` : ''}`} data-cadre={cadre}>
      <Entete />
      {p.nom === 'etape' && s && <BandeauSource />}
      {/* Repère stable pour les essais : le code de l'étape, quel que soit son titre affiché. */}
      <main ref={zone} data-etape={p.nom === 'etape' && s ? CODES_ETAPES[p.numero - 1] : undefined}>
        {contenu}
      </main>
      <Messages />
      <Dialogues />
      <Raccourcis />
    </div>
  );
}
