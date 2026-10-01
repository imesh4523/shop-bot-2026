import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Settings,
  LogOut,
  User,
  Menu,
  X,
  Users,
  Megaphone,
  ShieldCheck,
  ShieldAlert,
  Tag,
  Send,
  Share2,
  Smile,
  Ticket,
  LifeBuoy,
  Database,
  Clock,
  Key,
  ShoppingBag,
  Globe,
  Network,
  CreditCard,
  Layers,
  Puzzle,
  Mail,
  Sparkles,
  Flame,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfileButton } from "./profile-button";
import { AdminNotifier } from "./admin-notifier";
import { ThemeToggle } from "./theme-toggle";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/imeshadmindashbord', icon: LayoutDashboard },
    { name: '⚡ API Store Tracker', href: '/imeshadmindashbord/connected-stores', icon: Network, highlight: true },
    { name: 'Email Hub & Receipts', href: '/imeshadmindashbord/email-hub', icon: Mail },
    { name: 'All Orders', href: '/imeshadmindashbord/all-orders', icon: Layers },
    { name: 'API Keys', href: '/imeshadmindashbord/api-keys', icon: Key },
    { name: 'Domain Automation', href: '/imeshadmindashbord/domain-automation', icon: Globe },
    { name: 'PayHere Gateway', href: '/imeshadmindashbord/payhere', icon: CreditCard },
    { name: 'Store Mesh Connect', href: '/imeshadmindashbord/store-mesh', icon: Network },
    { name: 'Pre-Orders', href: '/imeshadmindashbord/preorders', icon: Clock },
    { name: 'Customer Audit & Fix', href: '/imeshadmindashbord/customer-tracker', icon: ShieldCheck },
    { name: 'Update Reports & Trace', href: '/imeshadmindashbord/software-updates', icon: Sparkles, highlight: true },
    { name: 'Broadcast', href: '/imeshadmindashbord/broadcast', icon: Megaphone },
    { name: 'Products', href: '/imeshadmindashbord/products', icon: Package },
    { name: 'Hero Banners & Slider', href: '/imeshadmindashbord/hero-banners', icon: Sparkles },
    { name: 'Best Sellers & Hot Deals', href: '/imeshadmindashbord/best-sellers', icon: Flame },
    { name: 'Categories & Badges', href: '/imeshadmindashbord/categories-manager', icon: Tag },
    { name: 'N1Panel SMM', href: '/imeshadmindashbord/n1panel', icon: Share2 },
    { name: 'Sandromania Shop', href: '/imeshadmindashbord/sandromania', icon: ShoppingBag },
    { name: 'Reseller API (CSxStore)', href: '/imeshadmindashbord/cssx-api', icon: Puzzle },
    { name: 'Inventory', href: '/imeshadmindashbord/inventory', icon: Package },
    { name: 'Orders', href: '/imeshadmindashbord/orders', icon: ShoppingCart },
    { name: 'Support Tickets', href: '/imeshadmindashbord/support-tickets', icon: LifeBuoy },
    { name: 'Payments', href: '/imeshadmindashbord/payments', icon: User },
    { name: 'Database Backup', href: '/imeshadmindashbord/backups', icon: Database },
    { name: 'Special Offers', href: '/imeshadmindashbord/special-offers', icon: Tag },
    { name: 'Promo Codes', href: '/imeshadmindashbord/promo-codes', icon: Ticket },
    { name: 'AWS Checker', href: '/imeshadmindashbord/aws-checker', icon: ShieldCheck },
    { name: 'Users', href: '/imeshadmindashbord/users', icon: Users },
    { name: 'Referral Program', href: '/imeshadmindashbord/referrals', icon: Users },
    { name: 'Spam Protector', href: '/imeshadmindashbord/spam-protector', icon: ShieldAlert },
    { name: 'Telegram Inspector', href: '/imeshadmindashbord/telegram-inspector', icon: Smile },
    { name: 'Telegram AI', href: '/imeshadmindashbord/telegram-client', icon: Send },
    { name: 'Auto Forward', href: '/imeshadmindashbord/forward', icon: Share2 },
    { name: 'Settings', href: '/imeshadmindashbord/settings', icon: Settings },
  ];

  const NavContent = () => (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex shrink-0 h-20 flex-none items-center px-6">
        <div className="flex items-center gap-3 font-black text-2xl text-white tracking-tighter">
          <div className="w-11 h-11 rounded-2xl overflow-hidden shadow-2xl border border-white/10 group-hover:scale-110 transition-transform duration-500 shrink-0">
            <img src="/logo.png" className="w-full h-full object-cover" />
          </div>
          <span className="truncate">Shopeefy</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pb-6">
        <nav className="grid gap-2 px-3">
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href === '/imeshadmindashbord/connected-stores' && location === '/imeshadmindashbord/api-store-tracker');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  flex shrink-0 items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black transition-all duration-300
                  ${isActive 
                    ? 'bg-purple-600/30 text-white shadow-[0_0_20px_rgba(168,85,247,0.2)] border border-purple-500/40 backdrop-blur-md' 
                    : (item as any).highlight 
                    ? 'bg-purple-950/40 text-purple-200 border border-purple-800/40 hover:bg-purple-900/50 hover:text-white' 
                    : 'text-white/50 hover:bg-white/5 hover:text-white'
                  }
                `}
                onClick={() => setIsMobileOpen(false)}
              >
                <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-purple-400' : (item as any).highlight ? 'text-purple-300' : 'text-white/40'}`} />
                <span className="truncate flex-1">{item.name}</span>
                {(item as any).highlight && !isActive && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    LIVE
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen relative overflow-x-hidden dark bg-background">
      {/* Dynamic Animated Orbs for Premium Purple Aesthetic */}
      <div className="orb w-[800px] h-[800px] bg-purple-600/10 -top-40 -left-40 animate-pulse pointer-events-none" />
      <div className="orb w-[600px] h-[600px] bg-indigo-600/5 bottom-20 right-20 pointer-events-none" />
      <div className="orb w-[400px] h-[400px] bg-purple-500/10 top-1/2 left-1/3 blur-[120px] pointer-events-none" />

      {/* Mobile Sidebar Sheet */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="w-72 sm:w-80 p-0 bg-[#0f0a1a] border-r border-white/5 flex flex-col z-50">
          <div className="flex-1 overflow-y-auto">
            <NavContent />
          </div>
          <div className="p-4 border-t border-white/5 bg-white/[0.01] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-purple-500/10 to-transparent" />
            <div className="relative text-[10px] text-white/30 font-black uppercase tracking-[0.3em] text-center">
              Developed by <span className="text-purple-400">Rochana Imesh</span>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col fixed inset-y-6 left-6 z-30 w-80 bg-[#0f0a1a] rounded-[2.5rem] border border-white/10 shadow-3xl overflow-hidden group">
        <div className="flex-1 overflow-hidden min-h-0">
          <NavContent />
        </div>
        <div className="mt-auto p-6 border-t border-white/5 bg-white/[0.01] space-y-4">
          <div className="relative py-2 group/watermark">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-purple-500/10 blur-xl opacity-0 group-hover/watermark:opacity-100 transition-opacity duration-700" />
            <div className="relative text-[10px] text-white/30 font-black uppercase tracking-[0.3em] text-center transition-all duration-500 group-hover/watermark:text-purple-400">
              Developed by <span className="text-white/50 group-hover/watermark:text-white transition-colors">Rochana Imesh</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-[22rem] min-h-screen flex flex-col relative z-10 w-full overflow-x-hidden">
        {/* Header - Mobile Only (Clean, Unified Top Bar with Hamburger & Logo) */}
        <header className="lg:hidden h-16 flex items-center justify-between px-4 sm:px-6 border-b border-white/10 bg-[#0f0a1a]/90 backdrop-blur-xl sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsMobileOpen(true)}
              className="h-10 w-10 glass-panel border-white/10 rounded-xl text-white hover:bg-white/10"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2 font-black text-lg text-white tracking-tight">
              <div className="w-7 h-7 rounded-lg overflow-hidden border border-white/10 shrink-0">
                <img src="/logo.png" className="w-full h-full object-cover" />
              </div>
              <span className="truncate">Shopeefy</span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                <Avatar className="h-9 w-9 border border-purple-500/30">
                  <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || 'User'} />
                  <AvatarFallback className="bg-purple-950 text-purple-300 font-bold">{user?.firstName?.[0] || 'A'}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-[#130b24] border-purple-500/20 text-white" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-bold leading-none">{user?.firstName || "Admin"}</p>
                  <p className="text-xs leading-none text-purple-300/60">Administrator</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={() => logout()} className="text-red-400 focus:bg-red-500/10 focus:text-red-300">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <div className="flex-1 p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto w-full overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
