import { Navbar } from "@/components/layout/Navbar";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function Footer() {
  return (
    <footer className="bg-muted/30 pt-20 pb-10 border-t border-border">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="md:col-span-2">
            <Link href="/">
              <a className="flex items-center gap-2 mb-6">
                <span className="font-heading font-bold text-2xl tracking-tight text-foreground">
                  LEAD<span className="text-primary">Awaker</span>
                </span>
              </a>
            </Link>
            <p className="text-muted-foreground max-w-sm mb-6">
              Pull fresh sales from leads you’ve already paid for and haven’t bought, using conversational AI.
            </p>
          </div>
          
          <div>
            <h4 className="font-heading font-bold mb-4">Company</h4>
            <ul className="space-y-3">
              <li><Link href="/"><a className="text-muted-foreground hover:text-primary transition-colors">Home</a></Link></li>
              <li><Link href="/about"><a className="text-muted-foreground hover:text-primary transition-colors">About</a></Link></li>
              <li><Link href="/services"><a className="text-muted-foreground hover:text-primary transition-colors">Services</a></Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-heading font-bold mb-4">Contact</h4>
            <ul className="space-y-3">
              <li><Link href="/book-demo"><a className="text-muted-foreground hover:text-primary transition-colors">Book a Demo</a></Link></li>
              <li className="text-muted-foreground">hello@leadawaker.com</li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Lead Awaker. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
