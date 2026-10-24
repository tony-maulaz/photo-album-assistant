// Parties de l'API d'accès aux fichiers propres à Chrome et Edge, absentes des
// types standard de TypeScript.

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FileSystemHandle {
  queryPermission(descripteur?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descripteur?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  /** Déplacer et/ou renommer (Chrome 110+ sur disque local ; à vérifier). */
  move?(destination: FileSystemDirectoryHandle | string, nouveauNom?: string): Promise<void>;
}

interface OptionsSelecteurDossier {
  id?: string;
  mode?: 'read' | 'readwrite';
  startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
}

interface OptionsSelecteurFichier {
  id?: string;
  startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
  types?: { description?: string; accept: Record<string, string[]> }[];
  excludeAcceptAllOption?: boolean;
  multiple?: boolean;
}

interface Window {
  showDirectoryPicker?(options?: OptionsSelecteurDossier): Promise<FileSystemDirectoryHandle>;
  showOpenFilePicker?(options?: OptionsSelecteurFichier): Promise<FileSystemFileHandle[]>;
}

/** Mémoire du tas JavaScript (Chrome uniquement, non standard). */
interface Performance {
  memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
}
