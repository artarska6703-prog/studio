
import { Transaction } from '@/lib/types';

export function getBalancedTxs(walletAddress: string): Transaction[] {
    const transactions: Transaction[] = [];

    // Level 0 -> 1: Root wallet interacts with large entities
    const depth1Wallets = {
        exchange: 'Binance111111111111111111111111111111111111',
        dex: 'Jupiter11111111111111111111111111111111111',
        whale: 'WhaleWallet11111111111111111111111111111111',
        bridge: 'Wormhole1111111111111111111111111111111111'
    };

    transactions.push({
        signature: 'sig_root_to_exchange',
        blockTime: Date.now() / 1000 - 86400 * 20,
        blockNumber: 1,
        status: 'confirmed',
        type: 'sent',
        fee: 0.0001,
        amount: -1000,
        valueUSD: 150000,
        symbol: 'SOL',
        mint: 'So11111111111111111111111111111111111111112',
        from: walletAddress,
        to: depth1Wallets.exchange,
        by: walletAddress,
        instruction: 'TRANSFER',
        interactedWith: [depth1Wallets.exchange],
    });

    transactions.push({
        signature: 'sig_root_from_whale',
        blockTime: Date.now() / 1000 - 86400 * 19,
        blockNumber: 2,
        status: 'confirmed',
        type: 'received',
        fee: 0.0001,
        amount: 5000,
        valueUSD: 750000,
        symbol: 'SOL',
        mint: 'So11111111111111111111111111111111111111112',
        from: depth1Wallets.whale,
        to: walletAddress,
        by: depth1Wallets.whale,
        instruction: 'TRANSFER',
        interactedWith: [depth1Wallets.whale],
    });

    transactions.push({
        signature: 'sig_root_to_dex',
        blockTime: Date.now() / 1000 - 86400 * 18,
        blockNumber: 3,
        status: 'confirmed',
        type: 'program_interaction',
        fee: 0.0001,
        amount: -250,
        valueUSD: 37500,
        symbol: 'SOL',
        mint: 'So11111111111111111111111111111111111111112',
        from: walletAddress,
        to: depth1Wallets.dex,
        by: walletAddress,
        instruction: 'SWAP',
        interactedWith: [depth1Wallets.dex],
    });

    transactions.push({
        signature: 'sig_root_to_bridge',
        blockTime: Date.now() / 1000 - 86400 * 17,
        blockNumber: 4,
        status: 'confirmed',
        type: 'sent',
        fee: 0.0001,
        amount: -100,
        valueUSD: 15000,
        symbol: 'SOL',
        mint: 'So11111111111111111111111111111111111111112',
        from: walletAddress,
        to: depth1Wallets.bridge,
        by: walletAddress,
        instruction: 'TRANSFER',
        interactedWith: [depth1Wallets.bridge],
    });
    
    transactions.push({
        signature: 'sig_whale_funding',
        blockTime: Date.now() / 1000 - 86400 * 25,
        blockNumber: 0,
        status: 'confirmed',
        type: 'received',
        fee: 0.0001,
        amount: 20000,
        valueUSD: 3000000,
        symbol: 'SOL',
        mint: 'So11111111111111111111111111111111111111112',
        from: 'GenesisWallet111111111111111111111111111111',
        to: depth1Wallets.whale,
        by: 'GenesisWallet111111111111111111111111111111',
        instruction: 'TRANSFER',
        interactedWith: ['GenesisWallet111111111111111111111111111111', depth1Wallets.whale]
    });


    // Level 1 -> 2: Large entities interact with Sharks and Fish
    const depth2Wallets: { type: 'shark' | 'fish', id: string, parent: string }[] = [];
    for (let i = 0; i < 20; i++) { // Increased count
        depth2Wallets.push({ type: 'shark', id: `SharkWallet${i}11111111111111111111111111111111`, parent: depth1Wallets.whale });
        depth2Wallets.push({ type: 'fish', id: `FishWalletA${i}111111111111111111111111111111`, parent: depth1Wallets.dex });
    }
    
    depth2Wallets.forEach((wallet, i) => {
        transactions.push({
            signature: `sig_l2_${wallet.type}_${i}`,
            blockTime: Date.now() / 1000 - 86400 * (15 - i * 0.2),
            blockNumber: 5 + i,
            status: 'confirmed',
            type: 'sent',
            fee: 0.0001,
            amount: wallet.type === 'shark' ? -400 : -20,
            valueUSD: wallet.type === 'shark' ? 60000 : 3000,
            symbol: 'SOL',
            mint: 'So11111111111111111111111111111111111111112',
            from: wallet.parent,
            to: wallet.id,
            by: wallet.parent,
            instruction: 'TRANSFER',
            interactedWith: [wallet.id, wallet.parent],
        });
    });

    // Level 2 -> 3
    const depth3Wallets: { type: 'fish' | 'shrimp', id: string, parent: string }[] = [];
    for (let i = 0; i < 50; i++) { // Increased count
        const parentIndex = i % depth2Wallets.length;
        depth3Wallets.push({
            type: i % 2 === 0 ? 'fish' : 'shrimp',
            id: `L3Wallet${i}1111111111111111111111111111111`,
            parent: depth2Wallets[parentIndex].id
        });
    }

    depth3Wallets.forEach((wallet, i) => {
        transactions.push({
            signature: `sig_l3_${i}`,
            blockTime: Date.now() / 1000 - 86400 * (10 - i * 0.1),
            blockNumber: 50 + i,
            status: 'confirmed',
            type: 'sent',
            fee: 0.0001,
            amount: - (i * 0.1 + 0.5),
            valueUSD: ((i*0.1+0.5) * 150 + (wallet.type === 'fish' ? 1000 : 50)),
            symbol: 'SOL',
            mint: 'So11111111111111111111111111111111111111112',
            from: wallet.parent,
            to: wallet.id,
            by: wallet.parent,
            instruction: 'TRANSFER',
            interactedWith: [wallet.id, wallet.parent],
        });
    });

    // Level 3 -> 4
    const depth4Wallets: { id: string, parent: string }[] = [];
    for (let i = 0; i < 100; i++) { // Increased count
        const parentIndex = i % depth3Wallets.length;
        depth4Wallets.push({
            id: `L4Wallet${i}1111111111111111111111111111111`,
            parent: depth3Wallets[parentIndex].id
        });
    }

    depth4Wallets.forEach((wallet, i) => {
        transactions.push({
            signature: `sig_l4_${i}`,
            blockTime: Date.now() / 1000 - 86400 * (5 - i * 0.05),
            blockNumber: 100 + i,
            status: 'confirmed',
            type: 'sent',
            fee: 0.0001,
            amount: - (i * 0.01 + 0.1),
            valueUSD: ((i * 0.01 + 0.1) * 150 + 10),
            symbol: 'SOL',
            mint: 'So11111111111111111111111111111111111111112',
            from: wallet.parent,
            to: wallet.id,
            by: wallet.parent,
            instruction: 'TRANSFER',
            interactedWith: [wallet.id, wallet.parent],
        });
    });

    // Level 4 -> 5
    const depth5Wallets: { id: string, parent: string }[] = [];
     for (let i = 0; i < 200; i++) { // Increased count
        const parentIndex = i % depth4Wallets.length;
        depth5Wallets.push({
            id: `L5Wallet${i}1111111111111111111111111111111`,
            parent: depth4Wallets[parentIndex].id
        });
    }

    depth5Wallets.forEach((wallet, i) => {
        transactions.push({
            signature: `sig_l5_${i}`,
            blockTime: Date.now() / 1000 - 86400 * (2 - i * 0.01),
            blockNumber: 200 + i,
            status: 'confirmed',
            type: 'sent',
            fee: 0.0001,
            amount: - (i * 0.001 + 0.01),
            valueUSD: ((i * 0.001 + 0.01) * 150 + 1),
            symbol: 'SOL',
            mint: 'So11111111111111111111111111111111111111112',
            from: wallet.parent,
            to: wallet.id,
            by: wallet.parent,
            instruction: 'TRANSFER',
            interactedWith: [wallet.id, wallet.parent],
        });
    });

    // --- More Realistic Hub Activity ---

    // 1. Binance Exchange Activity (Deposits & Withdrawals)
    for (let i=0; i<30; i++) {
        const traderId = `ExchangeTrader${i}1111111111111111111111111`;
        // Simulate Withdrawals FROM exchange
        transactions.push({
            signature: `sig_exchange_withdraw_${i}`,
            blockTime: Date.now() / 1000 - 86400 * (5 + i * 0.2),
            blockNumber: 400 + i,
            status: 'confirmed',
            type: 'sent',
            fee: 0.0001,
            amount: - (i * 2 + 10),
            valueUSD: ((i * 2 + 10) * 150),
            symbol: 'SOL',
            mint: 'So11111111111111111111111111111111111111112',
            from: depth1Wallets.exchange,
            to: traderId,
            by: depth1Wallets.exchange,
            instruction: 'TRANSFER',
            interactedWith: [traderId, depth1Wallets.exchange]
        });

        // Simulate Deposits TO exchange from existing wallets
        const depositingWallet = i < 15 ? depth3Wallets[i] : depth2Wallets[i-15];
        if (depositingWallet) {
             transactions.push({
                signature: `sig_exchange_deposit_${i}`,
                blockTime: Date.now() / 1000 - 86400 * (4.5 + i * 0.2),
                blockNumber: 430 + i,
                status: 'confirmed',
                type: 'sent',
                fee: 0.0001,
                amount: - (i * 0.2 + 1),
                valueUSD: ((i * 0.2 + 1) * 150),
                symbol: 'SOL',
                mint: 'So11111111111111111111111111111111111111112',
                from: depositingWallet.id,
                to: depth1Wallets.exchange,
                by: depositingWallet.id,
                instruction: 'TRANSFER',
                interactedWith: [depositingWallet.id, depth1Wallets.exchange]
            });
        }
    }
     // Whale deposits to Binance
    transactions.push({
        signature: 'sig_whale_to_binance',
        blockTime: Date.now() / 1000 - 86400 * 3,
        blockNumber: 460,
        status: 'confirmed',
        type: 'sent', fee: 0.0001,
        amount: -500, valueUSD: 75000,
        symbol: 'SOL',
        mint: 'So11111111111111111111111111111111111111112',
        from: depth1Wallets.whale, to: depth1Wallets.exchange, by: depth1Wallets.whale,
        instruction: 'TRANSFER',
        interactedWith: [depth1Wallets.whale, depth1Wallets.exchange],
    });


    // 2. Jupiter DEX Activity
    for (let i=0; i<30; i++) {
        const fishId = `DexFish${i}111111111111111111111111111111111`;
        transactions.push({
            signature: `sig_dex_fish_${i}`,
            blockTime: Date.now() / 1000 - 86400 * (4 + i * 0.1),
            blockNumber: 500 + i,
            status: 'confirmed',
            type: 'program_interaction',
            fee: 0.0005,
            amount: - (i * 0.1 + 0.1),
            valueUSD: ((i * 0.1 + 0.1) * 150),
            symbol: 'SOL',
            mint: 'So11111111111111111111111111111111111111112',
            from: fishId,
            to: depth1Wallets.dex,
            by: fishId,
            instruction: 'SWAP',
            interactedWith: [fishId, depth1Wallets.dex]
        });
    }

    // 3. Wormhole Bridge Activity
    for (let i=0; i<5; i++) {
        const bridgeUser = `BridgeUser${i}11111111111111111111111111111111`;
        transactions.push({
            signature: `sig_bridge_user_${i}`,
            blockTime: Date.now() / 1000 - 86400 * (3 - i * 0.5),
            blockNumber: 530 + i,
            status: 'confirmed',
            type: 'sent',
            fee: 0.0001,
            amount: - (i + 1),
            valueUSD: ((i + 1) * 150),
            symbol: 'SOL',
            mint: 'So11111111111111111111111111111111111111112',
            from: bridgeUser,
            to: depth1Wallets.bridge,
            by: bridgeUser,
            instruction: 'TRANSFER',
            interactedWith: [bridgeUser, depth1Wallets.bridge]
        });
    }
    
    // --- Cross-cluster transactions ---
    transactions.push({
        signature: `sig_cross_shark_trader`,
        blockTime: Date.now() / 1000 - 86400 * 8,
        blockNumber: 600,
        status: 'confirmed',
        type: 'sent',
        fee: 0.0001,
        amount: -50,
        valueUSD: 7500,
        symbol: 'SOL',
        mint: 'So11111111111111111111111111111111111111112',
        from: depth2Wallets.find(w => w.type === 'shark')!.id,
        to: depth2Wallets.find(w => w.type === 'fish')!.id,
        by: depth2Wallets.find(w => w.type === 'shark')!.id,
        instruction: 'TRANSFER',
        interactedWith: [depth2Wallets.find(w => w.type === 'shark')!.id, depth2Wallets.find(w => w.type === 'fish')!.id],
    });

    transactions.push({
        signature: `sig_cross_fish_exchange`,
        blockTime: Date.now() / 1000 - 86400 * 7,
        blockNumber: 601,
        status: 'confirmed',
        type: 'sent',
        fee: 0.0001,
        amount: -2,
        valueUSD: 300,
        symbol: 'SOL',
        mint: 'So11111111111111111111111111111111111111112',
        from: depth3Wallets[5].id,
        to: depth1Wallets.exchange,
        by: depth3Wallets[5].id,
        instruction: 'TRANSFER',
        interactedWith: [depth3Wallets[5].id, depth1Wallets.exchange],
    });

     transactions.push({
        signature: `sig_cross_trader_bridge`,
        blockTime: Date.now() / 1000 - 86400 * 6,
        blockNumber: 602,
        status: 'confirmed',
        type: 'sent',
        fee: 0.0001,
        amount: -10,
        valueUSD: 1500,
        symbol: 'SOL',
        mint: 'So11111111111111111111111111111111111111112',
        from: depth2Wallets.find(w => w.type === 'fish' && w.parent === depth1Wallets.dex)!.id,
        to: depth1Wallets.bridge,
        by: depth2Wallets.find(w => w.type === 'fish' && w.parent === depth1Wallets.dex)!.id,
        instruction: 'TRANSFER',
        interactedWith: [depth2Wallets.find(w => w.type === 'fish' && w.parent === depth1Wallets.dex)!.id, depth1Wallets.bridge],
    });

    transactions.push({
        signature: 'sig_random_whale_trader',
        blockTime: Date.now() / 1000 - 86400 * 5,
        blockNumber: 603,
        status: 'confirmed',
        type: 'sent',
        fee: 0.0001,
        amount: -100,
        valueUSD: 15000,
        symbol: 'SOL',
        mint: 'So11111111111111111111111111111111111111112',
        from: depth1Wallets.whale,
        to: depth2Wallets.find(w => w.type === 'fish' && w.parent === depth1Wallets.dex)!.id,
        by: depth1Wallets.whale,
        instruction: 'TRANSFER',
        interactedWith: [depth1Wallets.whale, depth2Wallets.find(w => w.type === 'fish' && w.parent === depth1Wallets.dex)!.id],
    });

    transactions.push({
        signature: 'sig_random_fish_fish',
        blockTime: Date.now() / 1000 - 86400 * 4,
        blockNumber: 604,
        status: 'confirmed',
        type: 'sent',
        fee: 0.0001,
        amount: -1,
        valueUSD: 150,
        symbol: 'SOL',
        mint: 'So11111111111111111111111111111111111111112',
        from: depth3Wallets[10].id,
        to: depth3Wallets[20].id,
        by: depth3Wallets[10].id,
        instruction: 'TRANSFER',
        interactedWith: [depth3Wallets[10].id, depth3Wallets[20].id],
    });


    return transactions;
}

export function getWhaleTxs(walletAddress: string): Transaction[] {
    return [
        {
            signature: 'sig_whale_1',
            blockTime: Date.now() / 1000 - 172800,
            blockNumber: 5,
            status: 'confirmed',
            type: 'received',
            fee: 0.00005,
            amount: 5000,
            valueUSD: 750000,
            symbol: 'SOL',
            mint: 'So11111111111111111111111111111111111111112',
            from: 'Binance111111111111111111111111111111111111',
            to: walletAddress,
            by: 'Binance111111111111111111111111111111111111',
            instruction: 'TRANSFER',
            interactedWith: ['Binance111111111111111111111111111111111111', walletAddress],
        },
        {
            signature: 'sig_whale_2',
            blockTime: Date.now() / 1000 - 86400,
            blockNumber: 6,
            status: 'confirmed',
            type: 'sent',
            fee: 0.0001,
            amount: -1000,
            valueUSD: 150000,
            symbol: 'SOL',
            mint: 'So11111111111111111111111111111111111111112',
            from: walletAddress,
            to: 'OrcaPool1111111111111111111111111111111111',
            by: walletAddress,
            instruction: 'ADD LIQUIDITY',
            interactedWith: ['OrcaPool1111111111111111111111111111111111', walletAddress],
        },
        {
            signature: 'sig_whale_3',
            blockTime: Date.now() / 1000 - 43200,
            blockNumber: 7,
            status: 'confirmed',
            type: 'program_interaction',
            fee: 0.0002,
            amount: 0,
            valueUSD: 250000,
            symbol: 'mSOL',
            mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
            from: 'MarinadeFi11111111111111111111111111111111',
            to: walletAddress,
            by: walletAddress,
            instruction: 'STAKE',
            interactedWith: ['MarinadeFi11111111111111111111111111111111', walletAddress],
        },
    ]
};

export function getDegenTxs(walletAddress: string): Transaction[] {
    return [
    ...Array.from({ length: 15 }, (_, i) => ({
        signature: `sig_degen_pump_${i}`,
        blockTime: Date.now() / 1000 - 3600 - (i * 120),
        blockNumber: 8 + i,
        status: 'confirmed' as 'confirmed',
        type: 'program_interaction' as 'program_interaction',
        fee: 0.001,
        amount: -0.1,
        valueUSD: 15,
        symbol: 'SOL',
        mint: 'So11111111111111111111111111111111111111112',
        from: walletAddress,
        to: `pumpfun${i}11111111111111111111111111111111111`,
        by: walletAddress,
        instruction: 'SWAP',
        interactedWith: [`pumpfun${i}11111111111111111111111111111111111`, `MemeCoin${i}11111111111111111111111111111111`, walletAddress],
    })),
    ...Array.from({ length: 10 }, (_, i) => ({
        signature: `sig_degen_raydium_${i}`,
        blockTime: Date.now() / 1000 - 7200 - (i * 180),
        blockNumber: 23 + i,
        status: 'confirmed' as 'confirmed',
        type: 'program_interaction' as 'program_interaction',
        fee: 0.0005,
        amount: i % 2 === 0 ? 500 : -500,
        valueUSD: 25,
        symbol: 'BONK',
        mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        from: i % 2 === 0 ? walletAddress : 'RaydiumLP111111111111111111111111111111111',
        to: i % 2 === 0 ? 'RaydiumLP111111111111111111111111111111111' : walletAddress,
        by: walletAddress,
        instruction: 'SWAP',
        interactedWith: ['RaydiumLP111111111111111111111111111111111', walletAddress],
    })),
]};

    

    