import { Header } from "@/components/layout/header";
import WalletSearch from "@/components/wallet/wallet-search";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { List } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 md:py-12">
        <div className="flex flex-col items-center text-center my-12 md:my-24">
          <h1 className="font-headline text-4xl md:text-6xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
            SolViz
          </h1>
          <p className="mt-4 max-w-2xl text-lg md:text-xl text-muted-foreground">
            The Professional Solana Wallet Explorer.
          </p>
          <div className="mt-8 w-full max-w-2xl">
            <WalletSearch />
          </div>
        </div>

        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <List className="text-primary"/>
                Recently Tracked Wallets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-8">
                <p>Bookmark wallets to see them here.</p>
                <p className="text-sm">(User authentication coming soon)</p>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground">
        Built for the Solana Ecosystem.
      </footer>
    </div>
  );
}
