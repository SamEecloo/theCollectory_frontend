import { Link, NavLink, useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/context/theme-context";
import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose,
} from "@/components/ui/sheet";
import Breadcrumbs from "@/components/breadcrumbs";
import { useAuth } from "@/context/useAuth";

export default function TopBar() {
  const { theme, toggle } = useTheme();

  const { logout } = useAuth();
  const navigate = useNavigate();

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <nav className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
      <NavLink to="/dashboard" className="text-sm hover:underline" onClick={onClick}>Dashboard</NavLink>
      <NavLink to="/collections/new" className="text-sm hover:underline" onClick={onClick}>New Collection</NavLink>
    </nav>
  );

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        {/* Left: Logo + Desktop Nav */}
        <div className="flex items-center gap-3">
          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <NavLinks onClick={() => { /* close via SheetClose below */ }} />
                <SheetClose asChild>
                  <Button variant="secondary" className="w-full mt-4">Close</Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>

          <Link to="/dashboard" className="font-semibold">My Collections</Link>

          {/* Desktop nav */}
          <div className="ml-6 hidden md:block">
            <NavLinks />
          </div>
        </div>

        {/* Right: User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full p-1 hover:bg-accent">
              <Avatar className="h-8 w-8">
                <AvatarFallback>ME</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate("/dashboard")}>Dashboard</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/collections/new")}>New Collection</DropdownMenuItem>
            <DropdownMenuItem onClick={logout} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Breadcrumbs */}
      <div className="container mx-auto px-4 pb-3">
        <Breadcrumbs />
      </div>
    </header>
  );
}
