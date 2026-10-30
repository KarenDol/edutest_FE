"use client"

import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { LayoutDashboard, ClipboardList, BarChart3, LogOut } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { clearAccessToken } from "@/lib/auth-token"

interface StudentSidebarProps {
  user: {
    name: string | null
    email: string | null
    phone?: string | null
    role: string
  }
}

export function StudentSidebar({ user }: StudentSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations("Nav")

  const navItems = [
    { href: "/student", labelKey: "studentDashboard" as const, icon: LayoutDashboard },
    { href: "/student/tests", labelKey: "studentTests" as const, icon: ClipboardList },
    { href: "/student/results", labelKey: "studentResults" as const, icon: BarChart3 },
  ]

  const handleSignOut = async () => {
    clearAccessToken()
    router.push("/")
    router.refresh()
  }

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen w-64 min-w-64 max-w-64 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border",
        "bg-sidebar text-sidebar-foreground",
      )}
    >
      <div className="p-6">
        <Link href="/student" className="flex justify-center">
          <BrandLogo
            width={200}
            height={56}
            className="h-10 w-auto max-w-full object-contain object-center"
          />
        </Link>
      </div>

      <Separator className="bg-sidebar-border" />

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== "/student" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold tracking-tight transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              {t(item.labelKey)}
            </Link>
          )
        })}
      </nav>

      <Separator className="bg-sidebar-border" />

      <div className="p-4">
        <div className="px-4 py-3 mb-2">
          <p className="text-sm font-medium truncate">{user.name || t("student")}</p>
          <p className="text-xs text-sidebar-foreground/60 truncate">{user.phone ?? user.email}</p>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          onClick={handleSignOut}
        >
          <LogOut className="h-5 w-5" />
          {t("signOut")}
        </Button>
      </div>
    </aside>
  )
}
