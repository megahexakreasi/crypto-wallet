import React, { useState, useMemo, useRef } from 'react';
import {
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  Filter,
  TrendingUp,
  TrendingDown,
  Minus,
  Copy,
  Check,
  ExternalLink,
  X,
  Search,
  RefreshCw
} from 'lucide-react';
import { formatAddress } from '../services/wallet';

// Pre-defined date range presets
const DATE_PRESETS = [
  { label: 'Hari Ini', days: 'today' },
  { label: '7 Hari', days: 7 },
  { label: '30 Hari', days: 30 },
  { label: '90 Hari', days: 90 },
  { label: '6 Bulan', days: 180 },
  { label: '1 Tahun', days: 365 },
  { label: 'Semua', days: null }
];

export const StatementHistory = ({
  transactions = [],
  tokenTransfers = [],
  network,
  activeWallet,
  nativeBalance,
  tokens = [],
  isLoading,
  onRefresh
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState(0); // default: Hari Ini
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'in', 'out', 'native', 'token'
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedHash, setCopiedHash] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const printRef = useRef(null);

  // Combine all transactions
  const allTransactions = useMemo(() => {
    // Build a map of token transfers by hash for cross-referencing
    const tokenByHash = {};
    tokenTransfers.forEach((t) => {
      tokenByHash[t.hash.toLowerCase()] = t;
    });

    const list = [];

    // 1. Process native transactions
    transactions.forEach((tx) => {
      const isTokenCall = parseFloat(tx.value || '0') === 0 && tokenByHash[tx.hash.toLowerCase()];

      if (isTokenCall) {
        // This is a contract call for a token transfer -> show as Gas Fee row
        const linkedToken = tokenByHash[tx.hash.toLowerCase()];
        list.push({
          ...tx,
          uniqueKey: tx.hash + '-gas',
          isGasFeeEntry: true,
          linkedToken
        });
      } else {
        // Normal native transaction (Kirim/Terima MTT)
        list.push({
          ...tx,
          uniqueKey: tx.hash + '-native'
        });

        // If this is an outgoing native transaction, ALSO generate its companion Gas Fee row
        if (tx.isOutgoing && tx.gasUsed && tx.gasPrice) {
          list.push({
            ...tx,
            uniqueKey: tx.hash + '-gas',
            isGasFeeEntry: true,
            linkedNative: {
              symbol: tx.symbol || network.symbol,
              value: tx.value
            }
          });
        }
      }
    });

    // 2. Process token transfers
    tokenTransfers.forEach((tx) => {
      list.push({
        ...tx,
        uniqueKey: tx.hash + '-token'
      });
    });

    return list.sort((a, b) => {
      if (b.timeStamp === a.timeStamp && a.hash === b.hash) {
        return a.isGasFeeEntry ? -1 : 1;
      }
      return (b.timeStamp || 0) - (a.timeStamp || 0);
    });
  }, [transactions, tokenTransfers, network]);

  // Apply date range + type filter + search
  const filteredTransactions = useMemo(() => {
    let list = [...allTransactions];

    // Date range filter
    const preset = DATE_PRESETS[selectedPreset];
    if (preset && preset.days === 'today') {
      // Start of today (local time)
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      list = list.filter((tx) => (tx.timeStamp || 0) >= startOfDay);
    } else if (preset && preset.days !== null) {
      const cutoff = Date.now() - preset.days * 24 * 60 * 60 * 1000;
      list = list.filter((tx) => (tx.timeStamp || 0) >= cutoff);
    }

    // Custom date override
    if (customDateFrom) {
      const from = new Date(customDateFrom).getTime();
      list = list.filter((tx) => (tx.timeStamp || 0) >= from);
    }
    if (customDateTo) {
      const to = new Date(customDateTo).getTime() + 24 * 60 * 60 * 1000; // end of day
      list = list.filter((tx) => (tx.timeStamp || 0) <= to);
    }

    // Type filter
    if (filterType === 'in') list = list.filter((tx) => !tx.isOutgoing);
    if (filterType === 'out') list = list.filter((tx) => tx.isOutgoing);
    if (filterType === 'native') list = list.filter((tx) => tx.type === 'native' || tx.type === 'internal');
    if (filterType === 'token') list = list.filter((tx) => tx.type === 'token');
    if (filterType === 'internal') list = list.filter((tx) => tx.type === 'internal');

    // Search filter (hash, address, symbol)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (tx) =>
          tx.hash?.toLowerCase().includes(q) ||
          tx.from?.toLowerCase().includes(q) ||
          tx.to?.toLowerCase().includes(q) ||
          tx.symbol?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allTransactions, selectedPreset, customDateFrom, customDateTo, filterType, searchQuery]);

  // Group transactions by date
  const groupedByDate = useMemo(() => {
    const groups = {};
    filteredTransactions.forEach((tx) => {
      const date = tx.timeStamp
        ? new Date(tx.timeStamp).toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : 'Tanggal Tidak Diketahui';
      if (!groups[date]) groups[date] = [];
      groups[date].push(tx);
    });
    return groups;
  }, [filteredTransactions]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let nativeIn = 0;
    let nativeOut = 0;
    let tokenInCount = 0;
    let tokenOutCount = 0;

    filteredTransactions.forEach((tx) => {
      if (tx.isGasFeeEntry) {
        let gasVal = 0;
        if (tx.gasUsed && tx.gasPrice) {
          try {
            gasVal = Number(BigInt(tx.gasUsed) * BigInt(tx.gasPrice)) / 1e18;
          } catch { gasVal = 0; }
        }
        totalOut += gasVal;
        nativeOut += gasVal;
        return;
      }
      const val = parseFloat(tx.value || '0');
      if (tx.isOutgoing) {
        totalOut += val;
        if (tx.type === 'token') tokenOutCount++;
        else nativeOut += val;
      } else {
        totalIn += val;
        if (tx.type === 'token') tokenInCount++;
        else nativeIn += val;
      }
    });

    return {
      totalIn,
      totalOut,
      netFlow: totalIn - totalOut,
      nativeIn,
      nativeOut,
      tokenInCount,
      tokenOutCount,
      txCount: filteredTransactions.length
    };
  }, [filteredTransactions]);

  // Running balance calculation (for native transactions, gas fees, and tokens)
  const runningBalances = useMemo(() => {
    const balances = new Map();

    // 1. Native & Gas Fee Running Balances
    const currentNativeBal = parseFloat(nativeBalance || '0');
    const nativeTxs = filteredTransactions.filter(
      (tx) => tx.type === 'native' || tx.type === 'internal' || tx.isGasFeeEntry
    );
    let runningNativeBal = currentNativeBal;

    nativeTxs.forEach((tx) => {
      balances.set(tx.uniqueKey || tx.hash, {
        balance: Math.max(0, runningNativeBal),
        symbol: network.symbol
      });
      if (tx.isGasFeeEntry) {
        let gasVal = 0;
        if (tx.gasUsed && tx.gasPrice) {
          try {
            gasVal = Number(BigInt(tx.gasUsed) * BigInt(tx.gasPrice)) / 1e18;
          } catch { gasVal = 0; }
        }
        runningNativeBal += gasVal;
      } else {
        const val = parseFloat(tx.value || '0');
        if (tx.isOutgoing) {
          runningNativeBal += val; // undo the outgoing to get previous balance
        } else {
          runningNativeBal -= val; // undo the incoming to get previous balance
        }
      }
    });

    // 2. Token Running Balances (grouped per token contract / symbol)
    const tokenTxs = filteredTransactions.filter((tx) => tx.type === 'token');
    const tokenGroups = {};
    tokenTxs.forEach((tx) => {
      const key = (tx.contractAddress || tx.symbol || '').toLowerCase();
      if (!tokenGroups[key]) tokenGroups[key] = [];
      tokenGroups[key].push(tx);
    });

    Object.keys(tokenGroups).forEach((tokenKey) => {
      const txList = tokenGroups[tokenKey];
      const tokenObj = tokens.find(
        (t) => (t.address || '').toLowerCase() === tokenKey || (t.symbol || '').toLowerCase() === tokenKey
      );
      const currentTokenBal = parseFloat(tokenObj?.balance || '0');

      let runningTokenBal = currentTokenBal;
      txList.forEach((tx) => {
        balances.set(tx.uniqueKey || tx.hash, {
          balance: Math.max(0, runningTokenBal),
          symbol: tx.symbol || tokenObj?.symbol || 'TOKEN'
        });
        const val = parseFloat(tx.value || '0');
        if (tx.isOutgoing) {
          runningTokenBal += val;
        } else {
          runningTokenBal -= val;
        }
      });
    });

    return balances;
  }, [filteredTransactions, nativeBalance, tokens, network]);

  const handleCopyHash = (hash) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const formatDateShort = (ts) => {
    if (!ts) return '-';
    try {
      return new Date(ts).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return '-';
    }
  };

  const formatCurrency = (val, decimals = 4) => {
    return parseFloat(val || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: decimals
    });
  };

  // Export as CSV
  const handleExportCSV = () => {
    const header = 'Tanggal,Waktu,Tipe,Arah,Dari,Ke,Jumlah,Simbol,Hash,Status\n';
    const rows = filteredTransactions.map((tx) => {
      const date = tx.timeStamp ? new Date(tx.timeStamp).toLocaleDateString('id-ID') : '-';
      const time = tx.timeStamp ? new Date(tx.timeStamp).toLocaleTimeString('id-ID') : '-';
      const type = tx.type === 'token' ? 'Token' : 'Native';
      const dir = tx.isOutgoing ? 'Keluar' : 'Masuk';
      const status = tx.isError ? 'Gagal' : 'Sukses';
      return `${date},${time},${type},${dir},${tx.from},${tx.to},${tx.value},${tx.symbol},${tx.hash},${status}`;
    });
    const csv = header + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `statement_${activeWallet?.address?.substring(0, 10)}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Print statement
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    printWindow.document.write(`
      <html>
        <head>
          <title>Statement - ${activeWallet?.name || 'Wallet'}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; padding: 32px; color: #1a1a2e; background: #fff; }
            .statement-header { text-align: center; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0; }
            .statement-header h1 { font-size: 1.6rem; font-weight: 800; color: #1a1a2e; margin-bottom: 4px; }
            .statement-header .subtitle { font-size: 0.9rem; color: #64748b; }
            .statement-info { display: flex; justify-content: space-between; margin-bottom: 24px; padding: 16px; background: #f8fafc; border-radius: 8px; }
            .statement-info div { font-size: 0.85rem; }
            .statement-info strong { display: block; font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
            .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
            .summary-card { padding: 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
            .summary-card .label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 600; }
            .summary-card .value { font-size: 1.1rem; font-weight: 700; margin-top: 4px; }
            .summary-card .value.green { color: #059669; }
            .summary-card .value.red { color: #dc2626; }
            .date-group { margin-bottom: 20px; }
            .date-group h3 { font-size: 0.85rem; font-weight: 700; color: #475569; margin-bottom: 8px; padding: 6px 12px; background: #f1f5f9; border-radius: 6px; }
            table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
            th { text-align: left; padding: 8px 10px; color: #64748b; font-weight: 600; font-size: 0.7rem; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
            td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; }
            .badge-in { background: #d1fae5; color: #065f46; }
            .badge-out { background: #fee2e2; color: #991b1b; }
            .amount-in { color: #059669; font-weight: 700; }
            .amount-out { color: #dc2626; font-weight: 700; }
            .hash { font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; color: #94a3b8; }
            .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 0.75rem; color: #94a3b8; }
            @media print { body { padding: 16px; } }
          </style>
        </head>
        <body>
          <div class="statement-header">
            <h1>📄 Laporan Mutasi (Statement)</h1>
            <div class="subtitle">${network.name} • ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
          
          <div class="statement-info">
            <div>
              <strong>Nama Akun</strong>
              ${activeWallet?.name || '-'}
            </div>
            <div>
              <strong>Alamat</strong>
              ${activeWallet?.address || '-'}
            </div>
            <div>
              <strong>Saldo Saat Ini</strong>
              ${formatCurrency(nativeBalance)} ${network.symbol}
            </div>
          </div>

          <div class="summary-grid">
            <div class="summary-card">
              <div class="label">Total Masuk</div>
              <div class="value green">+${formatCurrency(summary.totalIn)} ${network.symbol}</div>
            </div>
            <div class="summary-card">
              <div class="label">Total Keluar</div>
              <div class="value red">-${formatCurrency(summary.totalOut)} ${network.symbol}</div>
            </div>
            <div class="summary-card">
              <div class="label">Jumlah Transaksi</div>
              <div class="value">${summary.txCount}</div>
            </div>
          </div>

          ${Object.entries(groupedByDate)
            .map(
              ([date, txs]) => `
            <div class="date-group">
              <h3>${date}</h3>
              <table>
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Arah</th>
                    <th>Dari / Ke</th>
                    <th>Jumlah</th>
                    <th>Simbol</th>
                    <th>Saldo</th>
                    <th>Hash</th>
                  </tr>
                </thead>
                <tbody>
                  ${txs
                    .map((tx) => {
                      const rb = runningBalances.get(tx.hash);
                      return `
                    <tr>
                      <td>${formatDateShort(tx.timeStamp)}</td>
                      <td><span class="badge ${tx.isOutgoing ? 'badge-out' : 'badge-in'}">${tx.isOutgoing ? 'KELUAR' : 'MASUK'}</span></td>
                      <td>${tx.isOutgoing ? tx.to?.substring(0, 12) + '...' : tx.from?.substring(0, 12) + '...'}</td>
                      <td class="${tx.isOutgoing ? 'amount-out' : 'amount-in'}">${tx.isOutgoing ? '-' : '+'}${formatCurrency(tx.value, 6)}</td>
                      <td>${tx.symbol || network.symbol}</td>
                      <td>${rb !== undefined ? formatCurrency(rb) : '-'}</td>
                      <td class="hash">${tx.hash?.substring(0, 14)}...</td>
                    </tr>
                  `;
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
          `
            )
            .join('')}

          <div class="footer">
            Statement dicetak otomatis pada ${new Date().toLocaleString('id-ID')} • ${network.name} (Chain ID: ${network.chainId})
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
  };

  if (!isExpanded) {
    return (
      <div
        className="glass-panel statement-collapsed"
        onClick={() => setIsExpanded(true)}
        style={{
          padding: '18px 22px',
          marginTop: '16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.3s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            className="statement-icon-wrap"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(6, 182, 212, 0.12) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <FileText size={20} color="#818cf8" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Laporan Mutasi</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Statement lengkap seperti bank — {allTransactions.length} transaksi tercatat
            </div>
          </div>
        </div>
        <ChevronDown size={20} color="var(--text-muted)" className="statement-chevron" />
      </div>
    );
  }

  return (
    <div className="glass-panel statement-expanded" style={{ padding: '0', marginTop: '16px', overflow: 'hidden' }} ref={printRef}>
      {/* Statement Header */}
      <div
        className="statement-header-bar"
        style={{
          padding: '22px 24px 18px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(6, 182, 212, 0.05) 100%)',
          borderBottom: '1px solid var(--border-color)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(99, 102, 241, 0.3)'
              }}
            >
              <FileText size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.01em' }}>Laporan Mutasi</h2>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {activeWallet?.name} • {network.name}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={onRefresh}
              className="btn btn-ghost"
              style={{ padding: '7px 12px', fontSize: '0.78rem', borderRadius: '10px' }}
              disabled={isLoading}
              title="Refresh data dari Blockscout"
            >
              <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn btn-ghost"
              style={{
                padding: '7px 12px',
                fontSize: '0.78rem',
                borderRadius: '10px',
                background: showFilters ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                color: showFilters ? '#818cf8' : 'var(--text-secondary)'
              }}
            >
              <Filter size={14} />
              <span>Filter</span>
            </button>
            <button onClick={handleExportCSV} className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: '0.78rem', borderRadius: '10px' }} title="Export CSV">
              <Download size={14} />
              <span>CSV</span>
            </button>
            <button onClick={handlePrint} className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: '0.78rem', borderRadius: '10px' }} title="Cetak Statement">
              <Printer size={14} />
              <span>Cetak</span>
            </button>
            <button
              onClick={() => setIsExpanded(false)}
              className="btn btn-ghost"
              style={{ padding: '7px', borderRadius: '10px' }}
            >
              <ChevronUp size={16} />
            </button>
          </div>
        </div>

        {/* Account Info Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '12px',
            marginTop: '16px',
            padding: '14px 16px',
            background: 'rgba(0, 0, 0, 0.15)',
            borderRadius: '14px',
            border: '1px solid var(--border-color)'
          }}
        >
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '3px' }}>
              Alamat Akun
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 500 }}>
              {formatAddress(activeWallet?.address, 8, 6)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '3px' }}>
              Saldo Saat Ini
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>
              {formatCurrency(nativeBalance)} <span style={{ color: network.color || 'var(--accent-primary)', fontWeight: 600, fontSize: '0.8rem' }}>{network.symbol}</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '3px' }}>
              Jaringan
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
              {network.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({network.chainId})</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '3px' }}>
              Periode
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
              {DATE_PRESETS[selectedPreset]?.label || 'Kustom'}
            </div>
          </div>
        </div>
      </div>

      {/* Filters Panel (Collapsible) */}
      {showFilters && (
        <div
          className="statement-filters"
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-color)',
            background: 'rgba(0, 0, 0, 0.1)',
            animation: 'slideDown 0.2s ease'
          }}
        >
          {/* Date Presets */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              <Calendar size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              Periode Waktu
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {DATE_PRESETS.map((preset, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedPreset(i);
                    setCustomDateFrom('');
                    setCustomDateTo('');
                  }}
                  className="btn"
                  style={{
                    padding: '5px 14px',
                    fontSize: '0.78rem',
                    borderRadius: '8px',
                    background: selectedPreset === i ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    color: selectedPreset === i ? '#a5b4fc' : 'var(--text-secondary)',
                    border: `1px solid ${selectedPreset === i ? 'rgba(99, 102, 241, 0.35)' : 'var(--border-color)'}`,
                    fontWeight: selectedPreset === i ? 700 : 500
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom date range */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '12px' }}>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Dari Tanggal</label>
              <input
                type="date"
                value={customDateFrom}
                onChange={(e) => {
                  setCustomDateFrom(e.target.value);
                  setSelectedPreset(-1);
                }}
                className="input-field"
                style={{ padding: '8px 12px', fontSize: '0.82rem' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Sampai Tanggal</label>
              <input
                type="date"
                value={customDateTo}
                onChange={(e) => {
                  setCustomDateTo(e.target.value);
                  setSelectedPreset(-1);
                }}
                className="input-field"
                style={{ padding: '8px 12px', fontSize: '0.82rem' }}
              />
            </div>
            {(customDateFrom || customDateTo) && (
              <button
                onClick={() => {
                  setCustomDateFrom('');
                  setCustomDateTo('');
                  setSelectedPreset(5);
                }}
                className="btn btn-ghost"
                style={{ padding: '8px', borderRadius: '8px' }}
                title="Reset tanggal"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Type filter + Search */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { key: 'all', label: 'Semua' },
                { key: 'in', label: 'Masuk' },
                { key: 'out', label: 'Keluar' },
                { key: 'native', label: 'Native' },
                { key: 'token', label: 'Token' }
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilterType(f.key)}
                  className="btn"
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.75rem',
                    borderRadius: '8px',
                    background: filterType === f.key ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                    color: filterType === f.key ? '#34d399' : 'var(--text-secondary)',
                    border: `1px solid ${filterType === f.key ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)'}`,
                    fontWeight: filterType === f.key ? 700 : 500
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: '180px', position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Cari hash, alamat, simbol..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                style={{ padding: '8px 12px 8px 34px', fontSize: '0.82rem' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '10px',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)'
        }}
      >
        <div className="statement-summary-card" style={{
          padding: '14px 16px',
          background: 'rgba(16, 185, 129, 0.06)',
          borderRadius: '14px',
          border: '1px solid rgba(16, 185, 129, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <TrendingUp size={13} color="#34d399" />
            <span style={{ fontSize: '0.68rem', color: '#34d399', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Masuk</span>
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#34d399' }}>+{formatCurrency(summary.totalIn)}</div>
        </div>

        <div className="statement-summary-card" style={{
          padding: '14px 16px',
          background: 'rgba(244, 63, 94, 0.06)',
          borderRadius: '14px',
          border: '1px solid rgba(244, 63, 94, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <TrendingDown size={13} color="#fb7185" />
            <span style={{ fontSize: '0.68rem', color: '#fb7185', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Keluar</span>
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fb7185' }}>-{formatCurrency(summary.totalOut)}</div>
        </div>

        <div className="statement-summary-card" style={{
          padding: '14px 16px',
          background: summary.netFlow >= 0 ? 'rgba(99, 102, 241, 0.06)' : 'rgba(245, 158, 11, 0.06)',
          borderRadius: '14px',
          border: `1px solid ${summary.netFlow >= 0 ? 'rgba(99, 102, 241, 0.15)' : 'rgba(245, 158, 11, 0.15)'}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <Minus size={13} color={summary.netFlow >= 0 ? '#818cf8' : '#fbbf24'} />
            <span style={{ fontSize: '0.68rem', color: summary.netFlow >= 0 ? '#818cf8' : '#fbbf24', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Arus Bersih</span>
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: summary.netFlow >= 0 ? '#818cf8' : '#fbbf24' }}>
            {summary.netFlow >= 0 ? '+' : ''}{formatCurrency(summary.netFlow)}
          </div>
        </div>

        <div className="statement-summary-card" style={{
          padding: '14px 16px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '14px',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <FileText size={13} color="var(--text-muted)" />
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Transaksi</span>
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>{summary.txCount}</div>
        </div>
      </div>

      {/* Statement Table / Grouped List */}
      <div style={{ padding: '8px 16px 24px' }}>
        {filteredTransactions.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '48px 20px',
            color: 'var(--text-muted)'
          }}>
            <FileText size={40} style={{ margin: '0 auto 14px', opacity: 0.4 }} />
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Tidak Ada Transaksi</div>
            <div style={{ fontSize: '0.82rem', maxWidth: '320px', margin: '0 auto' }}>
              Tidak ditemukan transaksi untuk periode dan filter yang dipilih.
            </div>
          </div>
        ) : (
          Object.entries(groupedByDate).map(([dateLabel, txs]) => (
            <div key={dateLabel} style={{ marginBottom: '4px' }}>
              {/* Date Group Header */}
              <div
                className="statement-date-header"
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 5,
                  padding: '10px 10px',
                  marginTop: '12px',
                  marginBottom: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  background: 'rgba(10, 13, 20, 0.85)',
                  backdropFilter: 'blur(12px)',
                  borderRadius: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={13} color="var(--accent-primary)" />
                  {dateLabel}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {txs.length} transaksi
                </span>
              </div>

              {/* Column Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '62px 1fr 1fr 1fr 1fr 1fr 56px',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  marginBottom: '4px',
                  borderBottom: '1px solid var(--border-color)'
                }}
              >
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Token</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tx Hash</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>To / From</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Transaksi</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Nominal</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Saldo Akhir</span>
                <span></span>
              </div>

              {/* Data rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {txs.map((tx, idx) => {
                  const isOut = tx.isOutgoing;
                  const isCopied = copiedHash === tx.hash;
                  const explorerTxUrl = network.explorerUrl ? `${network.explorerUrl}/tx/${tx.hash}` : null;
                  const rb = runningBalances.get(tx.uniqueKey || tx.hash);

                  // Calculate gas fee
                  let gasFee = null;
                  if (tx.gasUsed && tx.gasPrice) {
                    try {
                      const gasWei = BigInt(tx.gasUsed) * BigInt(tx.gasPrice);
                      const gasEth = Number(gasWei) / 1e18;
                      gasFee = gasEth;
                    } catch { gasFee = null; }
                  }

                  // Determine coin symbol display
                  const coinSymbol = tx.symbol || network.symbol;
                  const isToken = tx.type === 'token';
                  const isInternal = tx.type === 'internal';
                  const isGasFee = tx.isGasFeeEntry === true;

                  return (
                    <div
                      key={(tx.uniqueKey || tx.hash) + '-' + idx}
                      className="statement-row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '62px 1fr 1fr 1fr 1fr 1fr 56px',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: isGasFee ? 'rgba(245, 158, 11, 0.03)' : 'rgba(255, 255, 255, 0.015)',
                        border: '1px solid transparent',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {/* Col 1: Icon + Token Name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '8px',
                            background: isGasFee ? 'rgba(245, 158, 11, 0.12)' : (isOut ? 'rgba(244, 63, 94, 0.1)' : 'rgba(16, 185, 129, 0.1)'),
                            border: `1px solid ${isGasFee ? 'rgba(245, 158, 11, 0.25)' : (isOut ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)')}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          {isGasFee ? (
                            <span style={{ fontSize: '13px' }}>⛽</span>
                          ) : (
                            isOut ? <ArrowUpRight size={13} color="#fb7185" /> : <ArrowDownLeft size={13} color="#34d399" />
                          )}
                        </div>
                        {isGasFee ? (
                          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fbbf24' }}>Gas</span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fbbf24' }}>Fee</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: isToken ? '#818cf8' : (isInternal ? '#22d3ee' : 'var(--text-primary)'), lineHeight: 1.2 }}>
                            {tx.tokenName || coinSymbol}
                          </span>
                        )}
                      </div>

                      {/* Col 2: TxHash */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tx.hash ? `${tx.hash.substring(0, 8)}...${tx.hash.substring(tx.hash.length - 6)}` : '-'}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {formatDateShort(tx.timeStamp)}
                        </div>
                      </div>

                      {/* Col 3: To / From */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '0.68rem', color: isGasFee ? '#fbbf24' : (isOut ? '#fb7185' : '#34d399'), fontWeight: 600 }}>
                            {isOut ? 'To' : 'From'}
                          </span>
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.73rem', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {isOut ? formatAddress(tx.to, 6, 4) : formatAddress(tx.from, 6, 4)}
                        </div>
                      </div>

                      {/* Col 4: Transaction Type */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                          {isGasFee ? (
                            <span style={{ fontWeight: 700, fontSize: '0.78rem', color: '#fbbf24' }}>
                              Gas Fee
                            </span>
                          ) : (
                            <span style={{ fontWeight: 700, fontSize: '0.78rem' }}>
                              {isOut ? 'Kirim' : 'Terima'}
                            </span>
                          )}
                          {isToken && (
                            <span style={{
                              fontSize: '0.58rem',
                              background: 'rgba(99, 102, 241, 0.12)',
                              color: '#818cf8',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              fontWeight: 600
                            }}>TOKEN</span>
                          )}
                          {isInternal && !isGasFee && (
                            <span style={{
                              fontSize: '0.58rem',
                              background: 'rgba(6, 182, 212, 0.12)',
                              color: '#22d3ee',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              fontWeight: 600
                            }}>INTERNAL</span>
                          )}
                          {tx.isError && (
                            <span style={{
                              fontSize: '0.58rem',
                              background: 'rgba(244, 63, 94, 0.12)',
                              color: '#f43f5e',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              fontWeight: 600
                            }}>GAGAL</span>
                          )}
                        </div>
                        {/* Show linked token or native info below gas fee entry */}
                        {isGasFee && tx.linkedToken && (
                          <div style={{ fontSize: '0.66rem', color: '#818cf8', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                            {tx.linkedToken.symbol} {formatCurrency(tx.linkedToken.value, 6)}
                          </div>
                        )}
                        {isGasFee && tx.linkedNative && (
                          <div style={{ fontSize: '0.66rem', color: '#10b981', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                            {tx.linkedNative.symbol} {formatCurrency(tx.linkedNative.value, 4)}
                          </div>
                        )}
                        {/* Show gas fee note on regular outgoing row */}
                        {!isGasFee && isOut && gasFee !== null && (
                          <div style={{ fontSize: '0.64rem', color: '#fbbf24', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                            ⛽ {gasFee < 0.0001 ? gasFee.toExponential(2) : gasFee.toFixed(6)} {network.symbol}
                          </div>
                        )}
                      </div>

                      {/* Col 5: Nominal */}
                      <div style={{ textAlign: 'right', minWidth: 0 }}>
                        {isGasFee ? (
                          <div style={{
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            color: '#fbbf24',
                            fontFamily: 'var(--font-mono)',
                            letterSpacing: '-0.02em'
                          }}>
                            -{gasFee !== null ? (gasFee < 0.0001 ? gasFee.toExponential(2) : gasFee.toFixed(6)) : '0.00'}
                          </div>
                        ) : (
                          <div style={{
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            color: isOut ? '#fb7185' : '#34d399',
                            fontFamily: 'var(--font-mono)',
                            letterSpacing: '-0.02em'
                          }}>
                            {isOut ? '-' : '+'}{formatCurrency(tx.value, 6)}
                          </div>
                        )}
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '1px' }}>
                          {isGasFee ? network.symbol : coinSymbol}
                        </div>
                      </div>

                      {/* Col 6: Saldo Akhir */}
                      <div style={{ textAlign: 'right', minWidth: 0 }}>
                        {rb !== undefined ? (
                          <>
                            <div style={{
                              fontWeight: 700,
                              fontSize: '0.82rem',
                              color: 'var(--text-primary)',
                              fontFamily: 'var(--font-mono)',
                              letterSpacing: '-0.02em'
                            }}>
                              {formatCurrency(typeof rb === 'object' ? rb.balance : rb, isToken ? 4 : 4)}
                            </div>
                            <div style={{
                              fontSize: '0.6rem',
                              color: isToken ? '#818cf8' : 'var(--text-muted)',
                              fontFamily: 'var(--font-mono)',
                              marginTop: '1px',
                              fontWeight: isToken ? 600 : 400
                            }}>
                              {typeof rb === 'object' ? rb.symbol : (isGasFee ? network.symbol : coinSymbol)}
                            </div>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.5 }}>—</span>
                        )}
                      </div>

                      {/* Col 6: Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleCopyHash(tx.hash)}
                          className="btn btn-ghost"
                          style={{ padding: '5px', borderRadius: '7px' }}
                          title="Salin Hash"
                        >
                          {isCopied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                        </button>
                        {explorerTxUrl && (
                          <a
                            href={explorerTxUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost"
                            style={{ padding: '5px', borderRadius: '7px', color: 'var(--text-secondary)', textDecoration: 'none' }}
                            title="Lihat di Explorer"
                          >
                            <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {filteredTransactions.length > 0 && (
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            background: 'rgba(0, 0, 0, 0.08)'
          }}
        >
          <span>
            Menampilkan {filteredTransactions.length} dari {allTransactions.length} transaksi
          </span>
          <span>
            Sumber data: Blockscout API • {network.name}
          </span>
        </div>
      )}
    </div>
  );
};
