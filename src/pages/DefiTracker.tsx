import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ExternalLink, RefreshCw, TrendingUp, TrendingDown, Activity, DollarSign, BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Pool {
  id: string;
  attributes: {
    name: string;
    address: string;
    base_token_price_usd: string;
    quote_token_price_usd: string;
    reserve_in_usd: string;
    volume_usd: {
      h24: string;
    };
    price_change_percentage: {
      h24: string;
    };
  };
  relationships: {
    dex: {
      data: {
        id: string;
      };
    };
  };
}

const NETWORKS = [
  { id: "eth", name: "Ethereum" },
  { id: "bsc", name: "BSC" },
  { id: "polygon_pos", name: "Polygon" },
  { id: "base", name: "Base" },
  { id: "arbitrum", name: "Arbitrum" },
  { id: "solana", name: "Solana" },
];

export default function DefiTracker() {
  const [selectedNetwork, setSelectedNetwork] = useState("eth");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: pools, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["defi-pools", selectedNetwork],
    queryFn: async () => {
      const response = await fetch(`https://api.geckoterminal.com/api/v2/networks/${selectedNetwork}/pools?include=dex&page=1`);
      if (!response.ok) {
        throw new Error("Falha ao buscar dados da GeckoTerminal");
      }
      const json = await response.json();
      return json.data as Pool[];
    },
    staleTime: 60000, // 1 minute
  });

  const filteredPools = pools?.filter(pool => 
    pool.attributes.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (value: string | number) => {
    const val = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(val)) return "$0.00";
    if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(2)}K`;
    return `$${val.toFixed(val < 1 ? 6 : 2)}`;
  };

  const formatPercent = (value: string) => {
    const val = parseFloat(value);
    if (isNaN(val)) return "0.00%";
    const sign = val >= 0 ? "+" : "";
    return `${sign}${val.toFixed(2)}%`;
  };

  if (error) {
    toast.error("Erro ao carregar dados DeFi. Tente novamente mais tarde.");
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight gradient-text-primary">Defi Tracker</h1>
          <p className="text-muted-foreground mt-1">Rastreador de liquidez em tempo real via GeckoTerminal</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()} 
            disabled={isLoading || isRefetching}
            className="h-9"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por pool (ex: WETH/USDC)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-11 glass-card"
          />
        </div>
        
        <Tabs value={selectedNetwork} onValueChange={setSelectedNetwork} className="w-full md:w-auto">
          <TabsList className="h-11 p-1 bg-secondary/50 border border-border">
            {NETWORKS.map((network) => (
              <TabsTrigger 
                key={network.id} 
                value={network.id}
                className="px-4 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {network.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="glass-card overflow-hidden">
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPools?.map((pool) => {
            const priceChange = parseFloat(pool.attributes.price_change_percentage.h24);
            const isPositive = priceChange >= 0;

            return (
              <Card key={pool.id} className="glass-card overflow-hidden group hover:border-primary/50 transition-all duration-300">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors">
                      {pool.attributes.name}
                    </CardTitle>
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {pool.relationships.dex.data.id.split('_')[0].toUpperCase()}
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-1 text-xs truncate">
                    {pool.attributes.address}
                    <a 
                      href={`https://www.geckoterminal.com/${selectedNetwork}/pools/${pool.attributes.address}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-secondary/30 p-3 rounded-lg border border-border/50">
                      <div className="text-[10px] text-muted-foreground uppercase flex items-center gap-1 mb-1">
                        <DollarSign className="h-3 w-3 text-primary" /> Preço
                      </div>
                      <div className="text-base font-bold truncate">
                        {formatCurrency(pool.attributes.base_token_price_usd)}
                      </div>
                    </div>
                    <div className="bg-secondary/30 p-3 rounded-lg border border-border/50">
                      <div className="text-[10px] text-muted-foreground uppercase flex items-center gap-1 mb-1">
                        <Activity className={`h-3 w-3 ${isPositive ? "text-green-500" : "text-red-500"}`} /> 24h %
                      </div>
                      <div className={`text-base font-bold flex items-center gap-1 ${isPositive ? "text-green-500" : "text-red-500"}`}>
                        {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        {formatPercent(pool.attributes.price_change_percentage.h24)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm border-b border-border/30 pb-2">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <BarChart3 className="h-3.5 w-3.5" /> Volume (24h)
                      </span>
                      <span className="font-semibold">{formatCurrency(pool.attributes.volume_usd.h24)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Activity className="h-3.5 w-3.5" /> TVL (Liquidez)
                      </span>
                      <span className="font-semibold">{formatCurrency(pool.attributes.reserve_in_usd)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          
          {filteredPools?.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              Nenhuma pool encontrada para sua busca.
            </div>
          )}
        </div>
      )}
    </div>
  );
}