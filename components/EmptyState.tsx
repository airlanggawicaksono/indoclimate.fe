// =============================
// components/EmptyState.tsx
// =============================
import Image from "next/image";

export default function EmptyState() {
  return (
    <div className="flex h-[60svh] items-center justify-center">
      <div className="flex flex-col items-center gap-8 opacity-80 transition-opacity duration-300">
        <div className="relative">
          <Image
            src="/images/Koneksi.webp"
            alt="Koneksi Logo"
            width={300}
            height={300}
            priority
            className="object-contain drop-shadow-2xl"
          />
        </div>
        <div className="text-center">
          <p className="text-xl font-light tracking-wide text-foreground/70">
            Gadjah Mada Uni for KONEKSI (Knowledge Partership Platform Australia-Indonesia)
          </p>
           <p className="text-xl font-light tracking-wide text-foreground/70">
            Indo-Climate Chatbot, Information center for climate laws and documents 
          </p>
          <p className="mt-2 text-sm font-light text-muted-foreground">
            ©2023-2024
          </p>
          
        </div>
      </div>
    </div>
  );
}
