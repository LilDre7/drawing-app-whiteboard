"use client";

import { Button } from "@/components/ui/button";
import {
  Menu as MenuIcon,
  MousePointer2,
  Hand,
  Pencil,
  Square,
  Circle,
  MessageSquare,
  ImageIcon,
  Eraser,
  Trash2,
  Github,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function MenuComponent() {
  return (
    <div className="flex h-full items-center gap-3 border-r px-4">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MenuIcon className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-full p-4 sm:w-[380px] overflow-y-auto">
          <Tabs defaultValue="help" className="mt-4 sm:mt-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="help" className="text-xs sm:text-sm">Ayuda</TabsTrigger>
              <TabsTrigger value="tips" className="text-xs sm:text-sm">Tips</TabsTrigger>
              <TabsTrigger value="about" className="text-xs sm:text-sm">Acerca de</TabsTrigger>
            </TabsList>
            <TabsContent value="help" className="mt-4 sm:mt-6 space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-3 py-2">
                  <MousePointer2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Seleccionar</p>
                    <p className="text-sm text-muted-foreground">
                      Selecciona y mueve objetos. Con imágenes, usa las esquinas para redimensionar.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 py-2">
                  <Hand className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Mano</p>
                    <p className="text-sm text-muted-foreground">
                      Navega por el canvas arrastrando.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 py-2">
                  <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Dibujo libre</p>
                    <p className="text-sm text-muted-foreground">
                      Dibuja a mano alzada arrastrando.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 py-2">
                  <Square className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Rectángulo</p>
                    <p className="text-sm text-muted-foreground">
                      Clic y arrastra para crear.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 py-2">
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Círculo</p>
                    <p className="text-sm text-muted-foreground">
                      Clic en el centro y arrastra.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 py-2">
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Texto</p>
                    <p className="text-sm text-muted-foreground">
                      Clic donde quieras escribir. Enter para confirmar.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 py-2">
                  <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Imagen</p>
                    <p className="text-sm text-muted-foreground">
                      Sube imágenes (máx. 300x300px). Puedes moverlas y redimensionarlas.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 py-2">
                  <Eraser className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Borrador</p>
                    <p className="text-sm text-muted-foreground">
                      Borra objetos haciendo clic o arrastrando sobre ellos.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 py-2">
                  <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Borrar todo</p>
                    <p className="text-sm text-muted-foreground">
                      Elimina todos los objetos del canvas.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="tips" className="mt-4 sm:mt-6 space-y-4">
              <div className="space-y-4 text-sm">
                <div>
                  <p className="mb-2 font-medium">Trabajando con imágenes</p>
                  <p className="text-muted-foreground">
                    Selecciona una imagen y usa las esquinas para redimensionarla. La proporción se mantiene automáticamente.
                  </p>
                </div>
                <div>
                  <p className="mb-2 font-medium">Navegación eficiente</p>
                  <p className="text-muted-foreground">
                    Usa la herramienta "Mano" para moverte rápidamente por el canvas.
                  </p>
                </div>
                <div>
                  <p className="mb-2 font-medium">Historial</p>
                  <p className="text-muted-foreground">
                    Todas las acciones se guardan. Usa Deshacer/Rehacer para navegar por tus cambios.
                  </p>
                </div>
                <div>
                  <p className="mb-2 font-medium">Edición de texto</p>
                  <p className="text-muted-foreground">
                    Haz doble clic en el título del proyecto para editarlo.
                  </p>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="about" className="mt-4 sm:mt-6 space-y-4">
              <div className="space-y-4 text-sm">
                <div>
                  <p className="mb-1 font-medium">Creado por</p>
                  <p className="text-muted-foreground">Alvaro Aburto Ocampo</p>
                </div>
                <div>
                  <p className="mb-1 font-medium">Proyecto</p>
                  <p className="mb-3 text-muted-foreground">
                    Aplicación de pizarra para crear wireframes, diagramas y notas visuales.
                  </p>
                  <a
                    href="https://github.com/tu-usuario/tu-proyecto"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground underline hover:text-foreground"
                  >
                    <Github className="h-4 w-4" />
                    Ver en GitHub
                  </a>
                </div>
                <div>
                  <p className="mb-2 font-medium">Características</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Herramientas de dibujo</li>
                    <li>• Soporte para imágenes</li>
                    <li>• Zoom y navegación</li>
                    <li>• Deshacer/Rehacer</li>
                    <li>• Exportar como PNG</li>
                    <li>• Modo oscuro</li>
                  </ul>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
      <span className="text-sm font-medium text-foreground">Whiteboard</span>
    </div>
  );
}
