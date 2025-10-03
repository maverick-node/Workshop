import { Button } from "@/components/ui/button";
import { GraduationCap, User, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { getSession, setSession, type User as SessionUser } from "@/lib/api";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [session, setSessionState] = useState<SessionUser | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setSessionState(getSession());
  }, []);

  // Global SSE listener for booking notifications
  useEffect(() => {
    const es = new EventSource(`${import.meta.env.VITE_API_BASE || '/api'}/events`);
    es.addEventListener("reservation", (evt: MessageEvent) => {
      try {
        const data = JSON.parse(evt.data || "{}");
        toast({ title: "New booking", description: `${data.userName || 'Someone'} booked ${data.workshopTitle || 'a workshop'}` });
      } catch {
        toast({ title: "New booking", description: "A new reservation has been made." });
      }
    });
    es.addEventListener("reservation_cancelled", (evt: MessageEvent) => {
      try {
        const data = JSON.parse(evt.data || "{}");
        toast({ title: "Booking cancelled", description: `${data.userName || 'Someone'} cancelled ${data.workshopTitle || 'a workshop'}` });
      } catch {
        toast({ title: "Booking cancelled", description: "A reservation was cancelled." });
      }
    });
    return () => { es.close(); };
  }, [toast]);

  return (
    <header className="bg-background border-b border-border sticky top-0 z-50 backdrop-blur-sm bg-background/95">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <GraduationCap className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground">Elevate</span>
          </div>

          {/* Desktop Navigation */}
          
          <nav className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-foreground hover:text-primary transition-colors">
              Home
            </Link>
          </nav>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {session ? (
              <>
                <span className="text-sm text-muted-foreground">Hi, {session.name}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSession(null);
                    setSessionState(null);
                    window.location.href = "/";
                  }}
                >
                  Logout
                </Button>
                {session.role === "admin" && (
                  <Link to="/admin">
                    <Button size="sm" className="bg-primary hover:bg-primary-hover">Admin Portal</Button>
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    <User className="h-4 w-4 mr-2" />
                    Login
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="outline" size="sm">Register</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <nav className="flex flex-col space-y-4">
              <Link to="/" className="text-foreground hover:text-primary transition-colors">
                Home
              </Link>
              <div className="flex flex-col space-y-2 pt-4">
                {session ? (
                  <>
                    <span className="text-sm text-muted-foreground">Hi, {session.name}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSession(null);
                        setSessionState(null);
                        window.location.href = "/";
                      }}
                    >
                      Logout
                    </Button>
                    {session.role === "admin" && (
                      <Link to="/admin">
                        <Button size="sm" className="bg-primary hover:bg-primary-hover">Admin Portal</Button>
                      </Link>
                    )}
                  </>
                ) : (
                  <>
                    <Link to="/login">
                      <Button variant="ghost" size="sm">
                        <User className="h-4 w-4 mr-2" />
                        Login
                      </Button>
                    </Link>
                    <Link to="/register">
                      <Button size="sm" className="bg-primary hover:bg-primary-hover">Register</Button>
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;