// Chart.js グローバルフォント設定（ダークモード対応）
        Chart.defaults.font.family = "'DM Sans', 'Noto Sans JP', sans-serif";
        Chart.defaults.font.size = 11;
        Chart.defaults.color = '#8A96A3';
        Chart.defaults.borderColor = 'rgba(201, 169, 98, 0.12)';
        Chart.defaults.plugins.legend.labels.usePointStyle = true;
        Chart.defaults.plugins.legend.labels.padding = 20;
        Chart.defaults.scale.grid.color = 'rgba(255, 255, 255, 0.04)';
        Chart.defaults.scale.ticks.color = '#5A6978';

        // グローバル変数
        let allRawData = []; // CSVから読み込んだ生データ
        let statsFilteredData = []; // 統計用フィルター済みデータ
        let allProperties = [];
        let filteredProperties = [];
        let currentPage = 1;
        const itemsPerPage = 50;

        // 売主ランキング用データ
        let allSellers = [];

        // 成約済み物件用データ
        let allSoldProperties = [];
        let periodFilteredSoldProperties = []; // 期間フィルター後のデータ
        let filteredSoldProperties = [];
        let soldCurrentPage = 1;
        
        // 期間フィルター設定
        let currentPeriodUnit = 'all'; // 'all', 'day', 'week', 'month'
        let currentPeriodValue = null; // 選択された期間の値

        // 売主在庫統計用データ
        let sellerStatsFilteredData = [];

        // 売主成約統計用データ
        let allSellerSoldProperties = [];
        let sellerPeriodFilteredSoldProperties = [];
        let sellerFilteredSoldProperties = [];
        let sellerSoldCurrentPeriodUnit = 'all';
        let sellerSoldCurrentPeriodValue = null;

        // 更新物件用データ
        let allUpdatedProperties = [];      // 全更新物件（master）
        let allUpdateDetails = [];          // 全更新詳細（updates）
        let filteredUpdatedProperties = []; // フィルター後の更新物件

        const districtColors = {
            "港区": "rgba(201, 169, 98, 0.9)",
            "中央区": "rgba(74, 111, 165, 0.9)",
            "千代田区": "rgba(45, 139, 122, 0.9)",
            "渋谷区": "rgba(139, 115, 85, 0.9)",
            "新宿区": "rgba(138, 150, 163, 0.9)",
            "文京区": "rgba(90, 105, 120, 0.9)"
        };

        const districts = ["港区", "中央区", "千代田区", "渋谷区", "新宿区", "文京区"];

        // Chart.js インスタンス保持
        let priceDistChartInstance = null;
        let districtChartInstance = null;
        let scatterAreaChartInstance = null;
        let scatterAgeChartInstance = null;
        let sellerTotalChartInstance = null;
        let sellerCountChartInstance = null;
        
        // 成約済み物件用Chart.jsインスタンス
        let soldDistrictChartInstance = null;
        let soldPriceRangeChartInstance = null;
        let soldTrendChartInstance = null;
        let soldLayoutChartInstance = null;
        let soldAreaRangeChartInstance = null;
        let soldScatterAreaChartInstance = null;
        let soldSellerTotalChartInstance = null;
        let soldSellerCountChartInstance = null;

        // 売主在庫統計用Chart.jsインスタンス
        let sellerWardChartInstance = null;
        let sellerPriceChartInstance = null;
        let sellerLayoutChartInstance = null;
        let sellerScatterAgeChartInstance = null;

        // 売主成約統計用Chart.jsインスタンス
        let sellerSoldDistrictChartInstance = null;
        let sellerSoldPriceRangeChartInstance = null;
        let sellerSoldTrendChartInstance = null;
        let sellerSoldLayoutChartInstance = null;
        let sellerSoldAreaRangeChartInstance = null;
        let sellerSoldScatterAreaChartInstance = null;

        // iOS判定（パフォーマンス最適化用）
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

        // 全角英字を半角に変換（間取りフィルター用）
        function normalizeLayout(str) {
            return str.replace(/[Ａ-Ｚａ-ｚ]/g, s =>
                String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
            );
        }

        // Chart.js更新用ヘルパー関数（destroy/recreateの代わりにupdateを使用してiOSでのフリーズを回避）
        function updateOrCreateChart(instance, canvasId, config) {
            if (instance) {
                instance.data = config.data;
                instance.options = config.options;
                instance.update('none'); // アニメーションなしで即座更新
                return instance;
            }
            return new Chart(document.getElementById(canvasId), config);
        }

        // 数値フォーマット
        function formatNumber(num) { return num.toLocaleString('ja-JP'); }

        // カウントアップアニメーション（iOS最適化版）
        function animateCountUp(element, targetValue, duration = 1000, isDecimal = false, suffix = '') {
            // iOS判定: アニメーションをスキップして直接表示（パフォーマンス向上）
            if (isIOS) {
                element.textContent = (isDecimal ? targetValue.toFixed(1) : formatNumber(Math.round(targetValue))) + suffix;
                return;
            }

            const startValue = 0;
            const startTime = performance.now();

            function update(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // イージング関数（easeOutExpo）
                const easeProgress = 1 - Math.pow(2, -10 * progress);
                const currentValue = startValue + (targetValue - startValue) * easeProgress;

                if (isDecimal) {
                    element.textContent = currentValue.toFixed(1) + suffix;
                } else {
                    element.textContent = formatNumber(Math.round(currentValue)) + suffix;
                }

                if (progress < 1) {
                    requestAnimationFrame(update);
                }
            }

            requestAnimationFrame(update);
        }

        // 価格文字列からの数値変換
        function parsePrice(priceStr) {
            if (!priceStr) return 0;
            const cleaned = priceStr.replace(/[",万円]/g, '');
            return parseFloat(cleaned) || 0;
        }

        // 面積文字列からの数値変換（㎡）
        function parseArea(areaStr) {
            if (!areaStr) return 0;
            const cleaned = areaStr.replace(/[㎡]/g, '');
            return parseFloat(cleaned) || 0;
        }

        // ㎡から坪への変換（1坪 = 3.30579㎡）
        function sqmToTsubo(sqm) {
            return sqm / 3.30579;
        }

        // 坪単価を計算（万円/坪）
        function calcTsuboPrice(price, areaSqm) {
            if (!areaSqm || areaSqm <= 0) return 0;
            const tsubo = sqmToTsubo(areaSqm);
            return tsubo > 0 ? price / tsubo : 0;
        }

        // 築年数計算
        function calcAge(yearStr) {
            if (!yearStr) return -1;
            const match = yearStr.match(/(\d{4})年/);
            if (match) {
                const year = parseInt(match[1]);
                return new Date().getFullYear() - year;
            }
            return -1;
        }

        // 区を抽出
        function extractDistrict(address) {
            for (const d of districts) {
                if (address && address.includes(d)) return d;
            }
            return '';
        }

        // CSVパース（フィールド内改行対応版）
        function parseCSV(text) {
            const records = parseCSVRecords(text);
            if (records.length === 0) return [];
            
            const headers = records[0];
            const data = [];
            for (let i = 1; i < records.length; i++) {
                const values = records[i];
                if (values.length === 1 && values[0].trim() === '') continue;
                const obj = {};
                headers.forEach((h, idx) => {
                    obj[h] = values[idx] !== undefined ? values[idx].trim() : '';
                });
                data.push(obj);
            }
            return data;
        }

        // フィールド内改行に対応したCSVパーサー
        function parseCSVRecords(text) {
            const records = [];
            let currentRecord = [];
            let currentField = '';
            let inQuotes = false;
            
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                const nextChar = text[i + 1];
                
                if (inQuotes) {
                    if (char === '"') {
                        if (nextChar === '"') {
                            // エスケープされたダブルクォート
                            currentField += '"';
                            i++;
                        } else {
                            // クォート終了
                            inQuotes = false;
                        }
                    } else {
                        // クォート内の文字（改行含む）
                        currentField += char;
                    }
                } else {
                    if (char === '"') {
                        // クォート開始
                        inQuotes = true;
                    } else if (char === ',') {
                        // フィールド区切り
                        currentRecord.push(currentField);
                        currentField = '';
                    } else if (char === '\r') {
                        // CRは無視（CRLF対応）
                        continue;
                    } else if (char === '\n') {
                        // レコード区切り
                        currentRecord.push(currentField);
                        if (currentRecord.length > 0) {
                            records.push(currentRecord);
                        }
                        currentRecord = [];
                        currentField = '';
                    } else {
                        currentField += char;
                    }
                }
            }
            
            // 最後のフィールド・レコードを追加
            if (currentField || currentRecord.length > 0) {
                currentRecord.push(currentField);
                records.push(currentRecord);
            }
            
            return records;
        }

        // データロード
        async function loadData() {
            try {
                const response = await fetch('daily_files/reins_20251215.csv');
                const text = await response.text();
                const rawData = parseCSV(text);
                
                allRawData = rawData.map(row => {
                    const price = parsePrice(row['価格']);
                    const areaSqm = parseArea(row['専有面積']);
                    const areaTsubo = sqmToTsubo(areaSqm);
                    const age = calcAge(row['築年月']);
                    const district = extractDistrict(row['所在地']);
                    const tsuboPrice = areaTsubo > 0 ? price / areaTsubo : 0;
                    
                    return {
                        id: parseInt(row['物件番号']) || 0,
                        district: district,
                        building: row['建物名'] || '',
                        floor: row['所在階'] || '',
                        layout: row['間取'] || '',
                        price: price,
                        priceStr: row['価格'] || '',
                        area: areaTsubo,
                        areaSqm: areaSqm,
                        areaStr: areaTsubo.toFixed(2) + '坪',
                        age: age,
                        status: row['取引状況'] || '-',
                        company: row['商号'] || '',
                        torihiki: row['取引態様'] || '',
                        tsuboPrice: tsuboPrice
                    };
                }).filter(d => d.district && d.price > 0);

                statsFilteredData = [...allRawData];
                allProperties = [...allRawData];
                filteredProperties = [...allProperties].sort((a,b) => a.id - b.id);

                // 売主在庫統計データの初期化
                sellerStatsFilteredData = allRawData.filter(d => d.torihiki === '売主');

                // 売主在庫統計フィルタの区・間取りオプション設定
                const sellerDistricts = [...new Set(sellerStatsFilteredData.map(d => d.district))].sort();
                const sellerLayouts = [...new Set(sellerStatsFilteredData.map(d => d.layout))].sort();

                const sellerWardSelect = document.getElementById('sellerStatsWardFilter');
                sellerDistricts.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d;
                    opt.textContent = d;
                    sellerWardSelect.appendChild(opt);
                });

                const sellerLayoutSelect = document.getElementById('sellerStatsLayoutFilter');
                sellerLayouts.forEach(l => {
                    const opt = document.createElement('option');
                    opt.value = l;
                    opt.textContent = l;
                    sellerLayoutSelect.appendChild(opt);
                });

                // 初期表示
                updateStatsDisplay();
                updateSellerStats();
                updateSellerStatsDisplay();
                updateSellerCharts();
                renderPropertyList();
                renderUpdateList('yesterday');

                // 成約済み物件データの読み込み
                await loadSoldData();

                document.getElementById('loadingOverlay').style.display = 'none';
            } catch(e) {
                console.error('データ読み込みエラー:', e);
                document.getElementById('loadingOverlay').style.display = 'none';
            }
        }

        // 統計表示更新
        function updateStatsDisplay() {
            const data = statsFilteredData;
            const totalCount = allRawData.length;
            const filteredCount = data.length;

            // フィルターバッジ表示
            const badge = document.getElementById('stats-filter-badge');
            if (filteredCount < totalCount) {
                badge.style.display = 'inline-flex';
                document.getElementById('stats-filtered-count').textContent = formatNumber(filteredCount);
                document.getElementById('stats-total-count').textContent = formatNumber(totalCount);
            } else {
                badge.style.display = 'none';
            }

            if (data.length === 0) {
                document.getElementById('stat-price-avg').textContent = '-';
                document.getElementById('stat-price-detail').textContent = '-';
                document.getElementById('stat-area-avg').textContent = '-';
                document.getElementById('stat-area-detail').textContent = '-';
                document.getElementById('stat-sqm-avg').textContent = '-';
                document.getElementById('stat-sqm-detail').textContent = '-';
                document.getElementById('stat-count').textContent = '0';
                document.getElementById('district-stats-body').innerHTML = '';
                return;
            }

            // 価格統計
            const prices = data.map(d => d.price).sort((a,b) => a - b);
            const avgPrice = prices.reduce((a,b) => a+b, 0) / prices.length;
            const medianPrice = prices[Math.floor(prices.length / 2)];
            const minPrice = prices[0];
            const maxPrice = prices[prices.length - 1];

            const priceEl = document.getElementById('stat-price-avg');
            animateCountUp(priceEl, Math.round(avgPrice), 800);
            document.getElementById('stat-price-detail').innerHTML = `中央値: ${formatNumber(medianPrice)}<br>最小: ${formatNumber(minPrice)} / 最大: ${formatNumber(maxPrice)}`;

            // 面積統計
            const areas = data.map(d => d.area).sort((a,b) => a - b);
            const avgArea = areas.reduce((a,b) => a+b, 0) / areas.length;
            const medianArea = areas[Math.floor(areas.length / 2)];
            const minArea = areas[0];
            const maxArea = areas[areas.length - 1];

            const areaEl = document.getElementById('stat-area-avg');
            animateCountUp(areaEl, Math.round(avgArea * 10) / 10, 800, true);
            document.getElementById('stat-area-detail').innerHTML = `中央値: ${medianArea.toFixed(1)}<br>最小: ${minArea.toFixed(1)} / 最大: ${maxArea.toFixed(1)}`;

            // 坪単価統計
            const tsuboPrices = data.filter(d => d.tsuboPrice > 0).map(d => d.tsuboPrice).sort((a,b) => a - b);
            if (tsuboPrices.length > 0) {
                const avgTsubo = tsuboPrices.reduce((a,b) => a+b, 0) / tsuboPrices.length;
                const medianTsubo = tsuboPrices[Math.floor(tsuboPrices.length / 2)];
                const tsuboEl = document.getElementById('stat-sqm-avg');
                animateCountUp(tsuboEl, Math.round(avgTsubo * 10) / 10, 800, true);
                document.getElementById('stat-sqm-detail').innerHTML = `中央値: ${medianTsubo.toFixed(1)}`;
            }

            // 物件数
            const countEl = document.getElementById('stat-count');
            animateCountUp(countEl, data.length, 800);

            // 区別統計
            const districtStatsHtml = districts.map(d => {
                const dData = data.filter(p => p.district === d);
                if (dData.length === 0) return '';
                const dPrices = dData.map(p => p.price).sort((a,b) => a - b);
                const dAvgPrice = dPrices.reduce((a,b) => a+b, 0) / dPrices.length;
                const dMedianPrice = dPrices[Math.floor(dPrices.length / 2)];
                const dAvgArea = dData.map(p => p.area).reduce((a,b) => a+b, 0) / dData.length;
                return `<tr><td>${d}</td><td class="text-right">${formatNumber(dData.length)}</td><td class="text-right">${formatNumber(Math.round(dAvgPrice * 10) / 10)}</td><td class="text-right">${formatNumber(dMedianPrice)}</td><td class="text-right">${dAvgArea.toFixed(1)}</td></tr>`;
            }).join('');
            document.getElementById('district-stats-body').innerHTML = districtStatsHtml;

            // チャート更新
            updateCharts();
        }

        // チャート更新
        function updateCharts() {
            const data = statsFilteredData;

            // 価格分布
            const priceRanges = {
                "〜3,000": 0,
                "3,000〜5,000": 0,
                "5,000〜7,000": 0,
                "7,000〜10,000": 0,
                "10,000〜15,000": 0,
                "15,000〜20,000": 0,
                "20,000〜30,000": 0,
                "30,000〜": 0
            };
            data.forEach(d => {
                if (d.price < 3000) priceRanges["〜3,000"]++;
                else if (d.price < 5000) priceRanges["3,000〜5,000"]++;
                else if (d.price < 7000) priceRanges["5,000〜7,000"]++;
                else if (d.price < 10000) priceRanges["7,000〜10,000"]++;
                else if (d.price < 15000) priceRanges["10,000〜15,000"]++;
                else if (d.price < 20000) priceRanges["15,000〜20,000"]++;
                else if (d.price < 30000) priceRanges["20,000〜30,000"]++;
                else priceRanges["30,000〜"]++;
            });

            if (priceDistChartInstance) priceDistChartInstance.destroy();
            priceDistChartInstance = new Chart(document.getElementById('priceDistChart'), {
                type: 'bar',
                data: {
                    labels: Object.keys(priceRanges),
                    datasets: [{ label: '在庫物件数', data: Object.values(priceRanges), backgroundColor: 'rgba(5, 31, 50, 0.75)', borderColor: 'rgba(5, 31, 50, 1)', borderWidth: 1 }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { title: { display: true, text: '価格帯 (万円)' } },
                        y: { beginAtZero: true, title: { display: true, text: '在庫物件数 (件)' } }
                    }
                }
            });

            // 区別物件数
            const districtCounts = districts.map(d => data.filter(p => p.district === d).length);
            if (districtChartInstance) districtChartInstance.destroy();
            districtChartInstance = new Chart(document.getElementById('districtChart'), {
                type: 'bar',
                data: {
                    labels: districts,
                    datasets: [{ label: '在庫物件数', data: districtCounts, backgroundColor: districts.map(d => districtColors[d]), borderWidth: 1 }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: '在庫物件数 (件)' } }
                    }
                }
            });

            // 散布図（面積 vs 価格）
            if (scatterAreaChartInstance) scatterAreaChartInstance.destroy();
            scatterAreaChartInstance = new Chart(document.getElementById('scatterAreaChart'), {
                type: 'scatter',
                data: {
                    datasets: districts.map(district => ({
                        label: district,
                        data: data.filter(d => d.district === district).map(d => ({ x: d.area, y: d.price })),
                        backgroundColor: districtColors[district],
                        pointRadius: 3
                    }))
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 12 } } }, scales: { x: { title: { display: true, text: '専有面積 (坪)' } }, y: { title: { display: true, text: '価格 (万円)' } } } }
            });

            // 散布図（築年数 vs 価格）
            if (scatterAgeChartInstance) scatterAgeChartInstance.destroy();
            scatterAgeChartInstance = new Chart(document.getElementById('scatterAgeChart'), {
                type: 'scatter',
                data: {
                    datasets: districts.map(district => ({
                        label: district,
                        data: data.filter(d => d.district === district && d.age >= 0).map(d => ({ x: d.age, y: d.price })),
                        backgroundColor: districtColors[district],
                        pointRadius: 3
                    }))
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 12 } } }, scales: { x: { title: { display: true, text: '築年数 (年)' } }, y: { title: { display: true, text: '価格 (万円)' } } } }
            });
        }

        // プルダウンの範囲値をパース
        function parseRangeValue(value) {
            if (!value) return { min: 0, max: Infinity };
            const parts = value.split('-');
            const min = parts[0] ? parseFloat(parts[0]) : 0;
            const max = parts[1] ? parseFloat(parts[1]) : Infinity;
            return { min, max };
        }

        // 統計フィルター適用
        function applyStatsFilter() {
            const torihiki = document.getElementById('stats-filter-torihiki').value;
            const district = document.getElementById('stats-filter-district').value;
            const layout = document.getElementById('stats-filter-layout').value;
            const priceRange = parseRangeValue(document.getElementById('stats-filter-price').value);
            const areaRange = parseRangeValue(document.getElementById('stats-filter-area').value);
            const ageRange = parseRangeValue(document.getElementById('stats-filter-age').value);

            statsFilteredData = allRawData.filter(p => {
                if (torihiki && p.torihiki !== torihiki) return false;
                if (district && p.district !== district) return false;
                if (layout && !normalizeLayout(p.layout).includes(layout)) return false;
                if (p.price < priceRange.min || p.price > priceRange.max) return false;
                if (p.area < areaRange.min || p.area > areaRange.max) return false;
                if (p.age >= 0 && (p.age < ageRange.min || p.age > ageRange.max)) return false;
                return true;
            });

            updateStatsDisplay();
        }

        // 統計フィルターリセット
        function resetStatsFilter() {
            document.getElementById('stats-filter-torihiki').value = '';
            document.getElementById('stats-filter-district').value = '';
            document.getElementById('stats-filter-layout').value = '';
            document.getElementById('stats-filter-price').value = '';
            document.getElementById('stats-filter-area').value = '';
            document.getElementById('stats-filter-age').value = '';
            statsFilteredData = [...allRawData];
            updateStatsDisplay();
        }

        // 商号別ランキング用フィルター済みデータ
        let sellerFilteredData = [];

        // 売主統計更新
        function updateSellerStats(filterDistrict = '', filterTorihiki = '') {
            // フィルター適用
            let targetData = allRawData;
            
            if (filterDistrict) {
                targetData = targetData.filter(d => d.district === filterDistrict);
            }
            if (filterTorihiki) {
                targetData = targetData.filter(d => d.torihiki === filterTorihiki);
            }
            
            sellerFilteredData = targetData;
            
            // フィルターバッジ表示
            const badge = document.getElementById('seller-filter-badge');
            const totalCount = allRawData.length;
            const filteredCount = targetData.length;
            
            if (filterDistrict || filterTorihiki) {
                badge.style.display = 'inline-flex';
                document.getElementById('seller-filtered-count').textContent = formatNumber(filteredCount);
                document.getElementById('seller-total-count').textContent = formatNumber(totalCount);
            } else {
                badge.style.display = 'none';
            }
            
            // タイトル更新
            let titlePrefix = '';
            if (filterTorihiki) {
                titlePrefix = filterTorihiki;
            }
            if (filterDistrict) {
                titlePrefix = titlePrefix ? `${filterDistrict} ${titlePrefix}` : filterDistrict;
            }
            titlePrefix = titlePrefix || '';
            
            const prefix = titlePrefix ? titlePrefix + ' ' : '';
            document.getElementById('seller-total-chart-title').textContent = `${prefix}在庫物件総額 TOP15`;
            document.getElementById('seller-count-chart-title').textContent = `${prefix}在庫物件数 TOP15`;
            document.getElementById('seller-ranking-title').textContent = `${prefix}在庫物件 商号別詳細ランキング`;
            
            // 商号別集計
            const sellerMap = {};
            targetData.forEach(d => {
                if (!sellerMap[d.company]) {
                    sellerMap[d.company] = { total: 0, count: 0 };
                }
                sellerMap[d.company].total += d.price;
                sellerMap[d.company].count++;
            });

            allSellers = Object.entries(sellerMap).map(([company, data]) => ({
                '商号': company,
                '物件総額_億円': data.total / 10000,
                '物件数': data.count,
                '平均単価_万円': data.total / data.count
            }));

            // サマリー更新
            const companyCount = Object.keys(sellerMap).length;
            const totalAmount = targetData.reduce((a, d) => a + d.price, 0) / 10000;
            const propertyCount = targetData.length;

            document.getElementById('seller-company-count').innerHTML = `${companyCount}<span class="stat-unit">社</span>`;
            document.getElementById('seller-total-amount').innerHTML = `${totalAmount.toFixed(1)}<span class="stat-unit">億円</span>`;
            document.getElementById('seller-property-count').innerHTML = `${formatNumber(propertyCount)}<span class="stat-unit">件</span>`;

            // チャート更新（updateOrCreateChartでiOSフリーズ回避）
            const sellerByTotal = [...allSellers].sort((a, b) => b['物件総額_億円'] - a['物件総額_億円']).slice(0, 15);
            const sellerByCount = [...allSellers].sort((a, b) => b['物件数'] - a['物件数']).slice(0, 15);

            sellerTotalChartInstance = updateOrCreateChart(sellerTotalChartInstance, 'sellerTotalChart', {
                type: 'bar',
                data: {
                    labels: sellerByTotal.map(d => d['商号'].substring(0, 12) + (d['商号'].length > 12 ? '...' : '')),
                    datasets: [{ label: '総額(億円)', data: sellerByTotal.map(d => d['物件総額_億円']), backgroundColor: 'rgba(201, 169, 98, 0.8)', borderWidth: 1 }]
                },
                options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, title: { display: true, text: '物件総額 (億円)' } } } }
            });

            sellerCountChartInstance = updateOrCreateChart(sellerCountChartInstance, 'sellerCountChart', {
                type: 'bar',
                data: {
                    labels: sellerByCount.map(d => d['商号'].substring(0, 12) + (d['商号'].length > 12 ? '...' : '')),
                    datasets: [{ label: '件数', data: sellerByCount.map(d => d['物件数']), backgroundColor: 'rgba(45, 139, 122, 0.8)', borderWidth: 1 }]
                },
                options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, title: { display: true, text: '物件数' } } } }
            });

            // ランキングテーブル初期表示
            renderRankingTable('total');
        }

        // 商号別ランキングフィルター適用
        function applySellerFilter() {
            const district = document.getElementById('seller-filter-district').value;
            const torihiki = document.getElementById('seller-filter-torihiki').value;
            updateSellerStats(district, torihiki);
        }

        // 商号別ランキングフィルターリセット
        function resetSellerFilter() {
            document.getElementById('seller-filter-district').value = '';
            document.getElementById('seller-filter-torihiki').value = '';
            updateSellerStats('', '');
        }

        // ランキングテーブル描画（DocumentFragmentでiOSリフロー削減）
        function renderRankingTable(sortBy = 'total') {
            const tbody = document.getElementById('sellerRankingBody');
            let sortedData;
            if (sortBy === 'total') sortedData = [...allSellers].sort((a,b) => b['物件総額_億円'] - a['物件総額_億円']);
            else if (sortBy === 'count') sortedData = [...allSellers].sort((a,b) => b['物件数'] - a['物件数']);
            else sortedData = [...allSellers].sort((a,b) => b['平均単価_万円'] - a['平均単価_万円']);

            // DocumentFragmentで一括追加（iOSでのリフロー削減）
            const fragment = document.createDocumentFragment();
            sortedData.forEach((item, index) => {
                const rank = index + 1;
                const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other';
                const tr = document.createElement('tr');
                tr.innerHTML = `<td><span class="rank-badge ${rankClass}">${rank}</span></td><td><span class="company-link" onclick="filterByCompany('${item['商号'].replace(/'/g, "\\'")}')">${item['商号']}</span></td><td class="text-right value-highlight">${item['物件総額_億円'].toFixed(1)}</td><td class="text-right">${item['物件数']}</td><td class="text-right">${formatNumber(Math.round(item['平均単価_万円']))}</td>`;
                fragment.appendChild(tr);
            });
            tbody.innerHTML = '';
            tbody.appendChild(fragment);
        }

        // 商号で物件リストをフィルター
        function filterByCompany(companyName) {
            switchSection('propertyList');
            document.getElementById('pl-filter-company').value = companyName;
            document.getElementById('pl-filter-notice').textContent = `「${companyName}」でフィルター中`;
            applyPropertyFilter();
        }

        // ===== 売主在庫統計関数 =====
        function updateSellerStatsDisplay() {
            const data = sellerStatsFilteredData;
            if (data.length === 0) {
                document.getElementById('sellerTotalCount').textContent = '0';
                document.getElementById('sellerAvgPrice').textContent = '-';
                document.getElementById('sellerAvgArea').textContent = '-';
                document.getElementById('sellerAvgUnitPrice').textContent = '-';
                return;
            }

            const totalCount = data.length;
            const avgPrice = data.reduce((a, d) => a + d.price, 0) / totalCount;
            const avgArea = data.reduce((a, d) => a + d.area, 0) / totalCount;
            const avgUnitPrice = data.reduce((a, d) => a + (d.tsuboPrice || 0), 0) / totalCount;

            animateCountUp(document.getElementById('sellerTotalCount'), totalCount, 800, false, '件');
            animateCountUp(document.getElementById('sellerAvgPrice'), avgPrice, 800, false, '万円');
            animateCountUp(document.getElementById('sellerAvgArea'), avgArea, 800, true, '坪');
            animateCountUp(document.getElementById('sellerAvgUnitPrice'), avgUnitPrice, 800, false, '万円');

            // 区別統計テーブル
            const wardStats = {};
            data.forEach(d => {
                if (!wardStats[d.district]) {
                    wardStats[d.district] = { count: 0, totalPrice: 0, totalArea: 0, totalUnitPrice: 0 };
                }
                wardStats[d.district].count++;
                wardStats[d.district].totalPrice += d.price;
                wardStats[d.district].totalArea += d.area;
                wardStats[d.district].totalUnitPrice += (d.tsuboPrice || 0);
            });

            const tbody = document.querySelector('#sellerWardStatsTable tbody');
            tbody.innerHTML = Object.entries(wardStats)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([ward, stats]) => `
                    <tr>
                        <td>${ward}</td>
                        <td class="text-right">${formatNumber(stats.count)}</td>
                        <td class="text-right">${formatNumber(Math.round(stats.totalPrice / stats.count))}万円</td>
                        <td class="text-right">${(stats.totalArea / stats.count).toFixed(1)}坪</td>
                        <td class="text-right">${formatNumber(Math.round(stats.totalUnitPrice / stats.count))}万円</td>
                    </tr>
                `).join('');
        }

        function updateSellerCharts() {
            const data = sellerStatsFilteredData;

            // 区別物件数チャート
            const wardCounts = {};
            data.forEach(d => wardCounts[d.district] = (wardCounts[d.district] || 0) + 1);

            sellerWardChartInstance = updateOrCreateChart(sellerWardChartInstance, 'sellerWardChart', {
                type: 'bar',
                data: {
                    labels: Object.keys(wardCounts),
                    datasets: [{
                        data: Object.values(wardCounts),
                        backgroundColor: Object.keys(wardCounts).map(d => districtColors[d] || 'rgba(201, 169, 98, 0.8)')
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });

            // 価格帯分布チャート
            const priceRanges = { '〜3000万': 0, '3000〜5000万': 0, '5000〜7000万': 0, '7000〜1億': 0, '1億〜': 0 };
            data.forEach(d => {
                if (d.price < 3000) priceRanges['〜3000万']++;
                else if (d.price < 5000) priceRanges['3000〜5000万']++;
                else if (d.price < 7000) priceRanges['5000〜7000万']++;
                else if (d.price < 10000) priceRanges['7000〜1億']++;
                else priceRanges['1億〜']++;
            });

            sellerPriceChartInstance = updateOrCreateChart(sellerPriceChartInstance, 'sellerPriceChart', {
                type: 'doughnut',
                data: {
                    labels: Object.keys(priceRanges),
                    datasets: [{
                        data: Object.values(priceRanges),
                        backgroundColor: ['#C9A962', '#4A6FA5', '#2D8B7A', '#8B7355', '#8A96A3']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });

            // 間取り別分布チャート
            const layoutCounts = {};
            data.forEach(d => layoutCounts[d.layout] = (layoutCounts[d.layout] || 0) + 1);

            sellerLayoutChartInstance = updateOrCreateChart(sellerLayoutChartInstance, 'sellerLayoutChart', {
                type: 'bar',
                data: {
                    labels: Object.keys(layoutCounts),
                    datasets: [{
                        data: Object.values(layoutCounts),
                        backgroundColor: 'rgba(201, 169, 98, 0.8)'
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });

            // 築年数 vs 価格散布図
            sellerScatterAgeChartInstance = updateOrCreateChart(sellerScatterAgeChartInstance, 'sellerScatterAgeChart', {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: '売主物件',
                        data: data.filter(d => d.age >= 0).map(d => ({ x: d.age, y: d.price })),
                        backgroundColor: 'rgba(201, 169, 98, 0.6)',
                        borderColor: 'rgba(201, 169, 98, 1)',
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: { x: { title: { display: true, text: '築年数' } }, y: { title: { display: true, text: '価格（万円）' } } }
                }
            });
        }

        function applySellerStatsFilter() {
            const wardFilter = document.getElementById('sellerStatsWardFilter').value;
            const layoutFilter = document.getElementById('sellerStatsLayoutFilter').value;
            const priceRange = parseRangeValue(document.getElementById('sellerStatsPriceFilter').value);
            const areaRange = parseRangeValue(document.getElementById('sellerStatsAreaFilter').value);
            const ageRange = parseRangeValue(document.getElementById('sellerStatsAgeFilter').value);

            sellerStatsFilteredData = allRawData.filter(d => {
                if (d.torihiki !== '売主') return false;
                if (wardFilter && d.district !== wardFilter) return false;
                if (layoutFilter && !normalizeLayout(d.layout).includes(layoutFilter)) return false;
                if (d.price < priceRange.min || d.price > priceRange.max) return false;
                const areaSqm = d.area * 3.30579;
                if (areaSqm < areaRange.min || areaSqm > areaRange.max) return false;
                if (d.age >= 0 && (d.age < ageRange.min || d.age > ageRange.max)) return false;
                return true;
            });

            updateSellerStatsDisplay();
            updateSellerCharts();
        }

        function resetSellerStatsFilter() {
            document.getElementById('sellerStatsWardFilter').value = '';
            document.getElementById('sellerStatsLayoutFilter').value = '';
            document.getElementById('sellerStatsPriceFilter').value = '';
            document.getElementById('sellerStatsAreaFilter').value = '';
            document.getElementById('sellerStatsAgeFilter').value = '';

            sellerStatsFilteredData = allRawData.filter(d => d.torihiki === '売主');
            updateSellerStatsDisplay();
            updateSellerCharts();
        }

        // ===== 売主成約統計関数 =====
        function updateSellerSoldStatsDisplay() {
            const data = sellerFilteredSoldProperties;
            if (data.length === 0) {
                document.getElementById('seller-sold-stat-count').textContent = '0';
                document.getElementById('seller-sold-stat-total').textContent = '-';
                document.getElementById('seller-sold-stat-avg').textContent = '-';
                document.getElementById('seller-sold-stat-avg-sqm').textContent = '-';
                document.getElementById('seller-sold-stat-count-detail').textContent = '-';
                document.getElementById('seller-sold-stat-total-detail').textContent = '-';
                document.getElementById('seller-sold-stat-avg-detail').textContent = '-';
                document.getElementById('seller-sold-stat-sqm-detail').textContent = '-';
                return;
            }

            const count = data.length;
            const total = data.reduce((a, d) => a + d.price, 0);
            const avg = total / count;
            const avgSqm = data.reduce((a, d) => a + (d.unitPrice || 0), 0) / count;

            animateCountUp(document.getElementById('seller-sold-stat-count'), count, 800, false, '件');
            document.getElementById('seller-sold-stat-count-detail').textContent = `期間内売主成約`;

            if (total >= 10000) {
                animateCountUp(document.getElementById('seller-sold-stat-total'), total / 10000, 800, true, '億円');
            } else {
                animateCountUp(document.getElementById('seller-sold-stat-total'), total, 800, false, '万円');
            }
            document.getElementById('seller-sold-stat-total-detail').textContent = `累計取引額`;

            animateCountUp(document.getElementById('seller-sold-stat-avg'), avg, 800, false, '万円');
            document.getElementById('seller-sold-stat-avg-detail').textContent = `中央値: ${formatNumber(Math.round(data.sort((a, b) => a.price - b.price)[Math.floor(count/2)]?.price || 0))}万円`;

            animateCountUp(document.getElementById('seller-sold-stat-avg-sqm'), avgSqm, 800, false, '万円/坪');
            const minSqm = Math.min(...data.map(d => d.unitPrice || 0));
            const maxSqm = Math.max(...data.map(d => d.unitPrice || 0));
            document.getElementById('seller-sold-stat-sqm-detail').textContent = `${formatNumber(Math.round(minSqm))}〜${formatNumber(Math.round(maxSqm))}`;
        }

        function updateSellerSoldCharts() {
            const data = sellerFilteredSoldProperties;

            // 区別成約分布
            const districtCounts = {};
            data.forEach(d => districtCounts[d.district] = (districtCounts[d.district] || 0) + 1);

            if (sellerSoldDistrictChartInstance) sellerSoldDistrictChartInstance.destroy();
            sellerSoldDistrictChartInstance = new Chart(document.getElementById('sellerSoldDistrictChart'), {
                type: 'doughnut',
                data: {
                    labels: Object.keys(districtCounts),
                    datasets: [{
                        data: Object.values(districtCounts),
                        backgroundColor: Object.keys(districtCounts).map(d => districtColors[d] || 'rgba(201, 169, 98, 0.8)')
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });

            // 価格帯別成約件数
            const priceRanges = { '〜3000万': 0, '3000〜5000万': 0, '5000〜7000万': 0, '7000〜1億': 0, '1億〜': 0 };
            data.forEach(d => {
                if (d.price < 3000) priceRanges['〜3000万']++;
                else if (d.price < 5000) priceRanges['3000〜5000万']++;
                else if (d.price < 7000) priceRanges['5000〜7000万']++;
                else if (d.price < 10000) priceRanges['7000〜1億']++;
                else priceRanges['1億〜']++;
            });

            if (sellerSoldPriceRangeChartInstance) sellerSoldPriceRangeChartInstance.destroy();
            sellerSoldPriceRangeChartInstance = new Chart(document.getElementById('sellerSoldPriceRangeChart'), {
                type: 'bar',
                data: {
                    labels: Object.keys(priceRanges),
                    datasets: [{
                        data: Object.values(priceRanges),
                        backgroundColor: 'rgba(201, 169, 98, 0.8)'
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });

            // 成約推移（日別）
            const dateCounts = {};
            data.forEach(d => {
                if (d.soldDate) {
                    const dateStr = d.soldDate.toISOString().split('T')[0];
                    dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
                }
            });
            const sortedDates = Object.keys(dateCounts).sort();

            if (sellerSoldTrendChartInstance) sellerSoldTrendChartInstance.destroy();
            sellerSoldTrendChartInstance = new Chart(document.getElementById('sellerSoldTrendChart'), {
                type: 'line',
                data: {
                    labels: sortedDates,
                    datasets: [{
                        label: '成約件数',
                        data: sortedDates.map(d => dateCounts[d]),
                        borderColor: 'rgba(201, 169, 98, 1)',
                        backgroundColor: 'rgba(201, 169, 98, 0.2)',
                        fill: true
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });

            // 間取別成約分布
            const layoutCounts = {};
            data.forEach(d => layoutCounts[d.layout] = (layoutCounts[d.layout] || 0) + 1);

            if (sellerSoldLayoutChartInstance) sellerSoldLayoutChartInstance.destroy();
            sellerSoldLayoutChartInstance = new Chart(document.getElementById('sellerSoldLayoutChart'), {
                type: 'bar',
                data: {
                    labels: Object.keys(layoutCounts),
                    datasets: [{
                        data: Object.values(layoutCounts),
                        backgroundColor: 'rgba(74, 111, 165, 0.8)'
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });

            // 面積帯別成約件数
            const areaRanges = { '〜10坪': 0, '10〜15坪': 0, '15〜20坪': 0, '20〜25坪': 0, '25〜30坪': 0, '30坪〜': 0 };
            data.forEach(d => {
                if (d.area < 10) areaRanges['〜10坪']++;
                else if (d.area < 15) areaRanges['10〜15坪']++;
                else if (d.area < 20) areaRanges['15〜20坪']++;
                else if (d.area < 25) areaRanges['20〜25坪']++;
                else if (d.area < 30) areaRanges['25〜30坪']++;
                else areaRanges['30坪〜']++;
            });

            if (sellerSoldAreaRangeChartInstance) sellerSoldAreaRangeChartInstance.destroy();
            sellerSoldAreaRangeChartInstance = new Chart(document.getElementById('sellerSoldAreaRangeChart'), {
                type: 'bar',
                data: {
                    labels: Object.keys(areaRanges),
                    datasets: [{
                        data: Object.values(areaRanges),
                        backgroundColor: 'rgba(45, 139, 122, 0.8)'
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });

            // 面積 vs 価格散布図
            if (sellerSoldScatterAreaChartInstance) sellerSoldScatterAreaChartInstance.destroy();
            sellerSoldScatterAreaChartInstance = new Chart(document.getElementById('sellerSoldScatterAreaChart'), {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: '売主成約物件',
                        data: data.map(d => ({ x: d.area, y: d.price })),
                        backgroundColor: 'rgba(201, 169, 98, 0.6)',
                        borderColor: 'rgba(201, 169, 98, 1)',
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: { x: { title: { display: true, text: '面積（坪）' } }, y: { title: { display: true, text: '価格（万円）' } } }
                }
            });
        }

        function applySellerSoldFilter() {
            const districtFilter = document.getElementById('seller-sold-filter-district').value;
            const layoutFilter = document.getElementById('seller-sold-filter-layout').value;
            const priceRange = parseRangeValue(document.getElementById('seller-sold-filter-price').value);
            const areaRange = parseRangeValue(document.getElementById('seller-sold-filter-area').value);
            const ageRange = parseRangeValue(document.getElementById('seller-sold-filter-age').value);

            sellerFilteredSoldProperties = sellerPeriodFilteredSoldProperties.filter(d => {
                if (districtFilter && d.district !== districtFilter) return false;
                if (layoutFilter && !normalizeLayout(d.layout).includes(layoutFilter)) return false;
                if (d.price < priceRange.min || d.price > priceRange.max) return false;
                const areaSqm = d.area * 3.30579;
                if (areaSqm < areaRange.min || areaSqm > areaRange.max) return false;
                if (d.age >= 0 && (d.age < ageRange.min || d.age > ageRange.max)) return false;
                return true;
            });

            updateSellerSoldStatsDisplay();
            updateSellerSoldCharts();
        }

        function resetSellerSoldFilter() {
            document.getElementById('seller-sold-filter-district').value = '';
            document.getElementById('seller-sold-filter-layout').value = '';
            document.getElementById('seller-sold-filter-price').value = '';
            document.getElementById('seller-sold-filter-area').value = '';
            document.getElementById('seller-sold-filter-age').value = '';

            sellerFilteredSoldProperties = [...sellerPeriodFilteredSoldProperties];
            updateSellerSoldStatsDisplay();
            updateSellerSoldCharts();
        }

        function changeSellerSoldPeriodUnit(unit) {
            sellerSoldCurrentPeriodUnit = unit;

            // ボタンのアクティブ状態を更新
            document.querySelectorAll('#soldListSeller .period-unit-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.unit === unit);
            });

            const container = document.getElementById('seller-period-value-container');
            const input = document.getElementById('seller-period-value-input');
            const label = document.getElementById('seller-period-value-label');

            if (unit === 'all') {
                container.style.display = 'none';
                sellerPeriodFilteredSoldProperties = [...allSellerSoldProperties];
                sellerFilteredSoldProperties = [...sellerPeriodFilteredSoldProperties];
                document.getElementById('seller-period-display-value').textContent = '全期間';
            } else {
                container.style.display = 'block';

                if (unit === 'day') {
                    label.textContent = '日付選択';
                    input.innerHTML = '<input type="date" id="seller-period-date-input" onchange="applySellerSoldPeriodFilter()">';
                } else if (unit === 'week') {
                    label.textContent = '週選択';
                    input.innerHTML = '<input type="week" id="seller-period-week-input" onchange="applySellerSoldPeriodFilter()">';
                } else if (unit === 'month') {
                    label.textContent = '月選択';
                    input.innerHTML = '<input type="month" id="seller-period-month-input" onchange="applySellerSoldPeriodFilter()">';
                }
            }

            updateSellerSoldStatsDisplay();
            updateSellerSoldCharts();
        }

        function applySellerSoldPeriodFilter() {
            const unit = sellerSoldCurrentPeriodUnit;
            let startDate, endDate, displayText;

            if (unit === 'day') {
                const dateValue = document.getElementById('seller-period-date-input').value;
                if (!dateValue) return;
                startDate = new Date(dateValue);
                endDate = new Date(dateValue);
                endDate.setDate(endDate.getDate() + 1);
                displayText = dateValue;
            } else if (unit === 'week') {
                const weekValue = document.getElementById('seller-period-week-input').value;
                if (!weekValue) return;
                const [year, week] = weekValue.split('-W');
                startDate = getDateOfISOWeek(parseInt(week), parseInt(year));
                endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + 7);
                displayText = `${year}年 第${week}週`;
            } else if (unit === 'month') {
                const monthValue = document.getElementById('seller-period-month-input').value;
                if (!monthValue) return;
                const [year, month] = monthValue.split('-');
                startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                endDate = new Date(parseInt(year), parseInt(month), 1);
                displayText = `${year}年${month}月`;
            }

            document.getElementById('seller-period-display-value').textContent = displayText;

            sellerPeriodFilteredSoldProperties = allSellerSoldProperties.filter(d => {
                if (!d.soldDate) return false;
                return d.soldDate >= startDate && d.soldDate < endDate;
            });

            sellerFilteredSoldProperties = [...sellerPeriodFilteredSoldProperties];
            updateSellerSoldStatsDisplay();
            updateSellerSoldCharts();
        }

        // 物件リストフィルター適用
        function applyPropertyFilter() {
            const district = document.getElementById('pl-filter-district').value;
            const torihiki = document.getElementById('pl-filter-torihiki').value;
            const building = document.getElementById('pl-filter-building').value.toLowerCase();
            const company = document.getElementById('pl-filter-company').value.toLowerCase();
            const layout = document.getElementById('pl-filter-layout').value;
            const priceRange = parseRangeValue(document.getElementById('pl-filter-price').value);
            const areaRange = parseRangeValue(document.getElementById('pl-filter-area').value);
            const ageRange = parseRangeValue(document.getElementById('pl-filter-age').value);

            filteredProperties = allProperties.filter(p => {
                if (district && p.district !== district) return false;
                if (torihiki && p.torihiki !== torihiki) return false;
                if (building && !p.building.toLowerCase().includes(building)) return false;
                if (company && !p.company.toLowerCase().includes(company)) return false;
                if (layout && !normalizeLayout(p.layout).includes(layout)) return false;
                if (p.price < priceRange.min || p.price > priceRange.max) return false;
                if (p.area < areaRange.min || p.area > areaRange.max) return false;
                if (p.age >= 0 && (p.age < ageRange.min || p.age > ageRange.max)) return false;
                return true;
            });

            currentPage = 1;
            sortPropertyList();
        }

        // 物件リストリセット
        function resetPropertyFilter() {
            document.getElementById('pl-filter-district').value = '';
            document.getElementById('pl-filter-torihiki').value = '';
            document.getElementById('pl-filter-building').value = '';
            document.getElementById('pl-filter-company').value = '';
            document.getElementById('pl-filter-layout').value = '';
            document.getElementById('pl-filter-price').value = '';
            document.getElementById('pl-filter-area').value = '';
            document.getElementById('pl-filter-age').value = '';
            document.getElementById('pl-filter-notice').textContent = '';
            filteredProperties = [...allProperties];
            currentPage = 1;
            sortPropertyList();
        }

        // 物件リストソート
        function sortPropertyList() {
            const sortValue = document.getElementById('pl-sort-select').value;
            const [field, order] = sortValue.split('-');
            filteredProperties.sort((a, b) => {
                let valA, valB;
                if (field === 'id') { valA = a.id; valB = b.id; }
                else if (field === 'price') { valA = a.price; valB = b.price; }
                else if (field === 'area') { valA = a.area; valB = b.area; }
                return order === 'asc' ? valA - valB : valB - valA;
            });
            currentPage = 1;
            renderPropertyList();
        }

        // 物件リスト描画
        function renderPropertyList() {
            const tbody = document.getElementById('propertyListBody');
            const totalCount = filteredProperties.length;
            const totalPages = Math.ceil(totalCount / itemsPerPage);
            const start = (currentPage - 1) * itemsPerPage;
            const end = start + itemsPerPage;
            const pageData = filteredProperties.slice(start, end);

            document.getElementById('pl-result-count').textContent = formatNumber(totalCount);

            tbody.innerHTML = pageData.map(p => {
                let statusClass = 'status-active';
                if (p.status === '申込あり') statusClass = 'status-pending';
                else if (p.status === '成約済み') statusClass = 'status-sold';
                else if (p.status === '一時停止') statusClass = 'status-paused';
                return `<tr><td>${p.id}</td><td>${p.district}</td><td>${p.building}</td><td>${p.floor}</td><td>${p.layout}</td><td class="text-right">${p.priceStr}</td><td class="text-right">${p.areaStr}</td><td class="text-right">${p.age >= 0 ? p.age + '年' : '-'}</td><td><span class="status-badge ${statusClass}">${p.status === '-' ? '公開中' : p.status}</span></td><td>${p.company}</td></tr>`;
            }).join('');

            renderPagination(totalPages);
        }

        // ページネーション描画
        function renderPagination(totalPages) {
            const container = document.getElementById('pl-pagination');
            if (totalPages <= 1) { container.innerHTML = ''; return; }
            
            let html = `<button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>← 前へ</button>`;
            const maxButtons = 5;
            let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
            let endPage = Math.min(totalPages, startPage + maxButtons - 1);
            if (endPage - startPage < maxButtons - 1) startPage = Math.max(1, endPage - maxButtons + 1);

            if (startPage > 1) html += `<button onclick="goToPage(1)">1</button><span>...</span>`;
            for (let i = startPage; i <= endPage; i++) {
                html += `<button onclick="goToPage(${i})" class="${i === currentPage ? 'active' : ''}">${i}</button>`;
            }
            if (endPage < totalPages) html += `<span>...</span><button onclick="goToPage(${totalPages})">${totalPages}</button>`;
            html += `<button onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>次へ →</button>`;
            container.innerHTML = html;
        }

        function goToPage(page) { currentPage = page; renderPropertyList(); }

        // CSV出力
        function exportPropertyCSV() {
            const headers = ['物件番号','区','建物名','所在階','間取','価格','専有面積(坪)','築年数','取引状況','商号'];
            const rows = filteredProperties.map(p => [p.id, p.district, p.building, p.floor, p.layout, p.priceStr, p.areaStr, p.age >= 0 ? p.age : '', p.status, p.company]);
            const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
            const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'property_list.csv';
            link.click();
            showToast(`${filteredProperties.length}件のデータをエクスポートしました`);
        }

        // 更新物件リスト描画（実データ対応版）
        function renderUpdateList(period) {
            // 期間でフィルタリング
            const today = new Date();
            let filtered = [...allUpdatedProperties];
            
            if (period === 'yesterday') {
                // 昨日以降（直近1日）
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];
                filtered = filtered.filter(u => u.updateDate >= yesterdayStr);
            } else if (period === 'week') {
                // 1週間前から
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                const weekAgoStr = weekAgo.toISOString().split('T')[0];
                filtered = filtered.filter(u => u.updateDate >= weekAgoStr);
            } else if (period === 'month') {
                // 1か月前から
                const monthAgo = new Date(today);
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                const monthAgoStr = monthAgo.toISOString().split('T')[0];
                filtered = filtered.filter(u => u.updateDate >= monthAgoStr);
            }

            // 更新日の新しい順でソート
            filtered.sort((a, b) => {
                if (a.updateDate > b.updateDate) return -1;
                if (a.updateDate < b.updateDate) return 1;
                return 0;
            });

            document.getElementById('ul-result-count').textContent = filtered.length;
            const tbody = document.getElementById('updateListBody');
            
            if (filtered.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:40px;">該当する更新物件がありません</td></tr>';
                return;
            }

            // 各更新物件について、differences_updates.csvから詳細を取得して表示
            const rows = [];
            filtered.forEach(prop => {
                // この物件の更新詳細を取得
                const details = allUpdateDetails.filter(d => d['差分ID'] === prop.diffId);
                
                if (details.length === 0) {
                    // 詳細がない場合はmasterの情報のみ表示
                    rows.push({
                        id: prop.id,
                        building: prop.building,
                        updateDate: prop.updateDate,
                        type: prop.updateFieldList,
                        before: '-',
                        after: '-',
                        note: `${prop.updateFieldCount}項目更新`
                    });
                } else {
                    // 詳細がある場合は各フィールドの変更を表示
                    details.forEach((detail, idx) => {
                        const updateField = detail['更新フィールド'] || '';
                        const beforeVal = detail['更新前'] || '';
                        const afterVal = detail['更新後'] || '';
                        
                        // 更新タイプを判定
                        let updateType = updateField;
                        if (updateField === '価格' || updateField === '㎡単価' || updateField === '坪単価') {
                            updateType = '価格変更';
                        } else if (updateField === '取引状況') {
                            updateType = '取引状況';
                        }

                        // 備考を生成
                        let note = '';
                        if (updateField === '価格') {
                            const beforePrice = parsePrice(beforeVal);
                            const afterPrice = parsePrice(afterVal);
                            const diff = beforePrice - afterPrice;
                            if (diff > 0) {
                                note = `${formatNumber(diff)}万円値下げ`;
                            } else if (diff < 0) {
                                note = `${formatNumber(Math.abs(diff))}万円値上げ`;
                            }
                        }

                        rows.push({
                            id: idx === 0 ? prop.id : '', // 同一物件の2行目以降はID非表示
                            building: idx === 0 ? prop.building : '', // 同一物件の2行目以降は建物名非表示
                            updateDate: prop.updateDate,
                            type: updateType,
                            field: updateField,
                            before: beforeVal,
                            after: afterVal,
                            note: note
                        });
                    });
                }
            });

            tbody.innerHTML = rows.map(u => {
                // バッジのスタイルを決定
                let badgeClass = 'update-status';
                if (u.type === '価格変更' || u.field === '価格') {
                    // 価格の増減を判定
                    const beforePrice = parsePrice(u.before);
                    const afterPrice = parsePrice(u.after);
                    badgeClass = beforePrice > afterPrice ? 'update-price-down' : 'update-price-up';
                } else if (u.type === '取引状況' || u.field === '取引状況') {
                    badgeClass = 'update-status';
                }

                const displayType = u.field || u.type;
                
                return `<tr>
                    <td>${u.id}</td>
                    <td>${u.building}</td>
                    <td><span class="update-badge ${badgeClass}">${displayType}</span></td>
                    <td>${u.before}</td>
                    <td style="font-weight:600;">${u.after}</td>
                    <td>${u.note}</td>
                </tr>`;
            }).join('');
        }

        // ナビゲーション切り替え
        function switchSection(sectionId) {
            document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
            document.querySelectorAll('.mobile-nav-link').forEach(link => link.classList.remove('active'));
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            
            document.querySelectorAll(`[data-section="${sectionId}"]`).forEach(el => el.classList.add('active'));
            document.getElementById(sectionId).classList.add('active');
            
            // モバイルメニューを閉じる
            document.getElementById('mobileMenu').classList.remove('active');
            document.getElementById('hamburger').classList.remove('active');
        }

        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => switchSection(link.dataset.section));
        });

        document.querySelectorAll('.mobile-nav-link').forEach(link => {
            link.addEventListener('click', () => switchSection(link.dataset.section));
        });

        // ハンバーガーメニュー
        document.getElementById('hamburger').addEventListener('click', () => {
            document.getElementById('hamburger').classList.toggle('active');
            document.getElementById('mobileMenu').classList.toggle('active');
        });

        // ランキングタブ
        document.querySelectorAll('.ranking-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.ranking-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderRankingTable(tab.dataset.sort);
            });
        });

        // 時間フィルターボタン
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderUpdateList(btn.dataset.period);
            });
        });

        // 日次ファイルキャッシュ（物件番号をキーとした辞書）
        const dailyFileCache = {};

        // 日次ファイルフォルダのパス
        const DAILY_FILES_PATH = 'daily_files/';

        // 日次ファイルを読み込んでキャッシュ
        async function loadDailyFile(filename) {
            // フルパスを構築（既にパスが含まれていない場合のみプレフィックスを追加）
            const filePath = filename.includes('/') ? filename : DAILY_FILES_PATH + filename;
            
            if (dailyFileCache[filename]) {
                return dailyFileCache[filename];
            }
            try {
                const response = await fetch(filePath);
                if (!response.ok) {
                    console.warn(`日次ファイル読み込み失敗: ${filePath}`);
                    return null;
                }
                const text = await response.text();
                const data = parseCSV(text);
                // 物件番号をキーとした辞書に変換
                const dataMap = {};
                data.forEach(row => {
                    const propertyId = row['物件番号'];
                    if (propertyId) {
                        dataMap[propertyId] = row;
                    }
                });
                dailyFileCache[filename] = dataMap;
                return dataMap;
            } catch (e) {
                console.warn(`日次ファイル読み込みエラー: ${filePath}`, e);
                return null;
            }
        }

        // 成約済み・更新物件データ読み込み（方式B対応版）
        async function loadSoldData() {
            try {
                // differences_master.csv読み込み
                const response = await fetch('differences_master.csv');
                const text = await response.text();
                const diffData = parseCSV(text);
                
                // differences_updates.csv読み込み
                let updatesData = [];
                try {
                    const updatesResponse = await fetch('differences_updates.csv');
                    if (updatesResponse.ok) {
                        const updatesText = await updatesResponse.text();
                        updatesData = parseCSV(updatesText);
                        console.log(`differences_updates.csv: ${updatesData.length}件読み込み`);
                    }
                } catch (e) {
                    console.warn('differences_updates.csv読み込みエラー:', e);
                }

                // 参照元ファイルの一覧を取得（重複排除）
                const referenceFiles = [...new Set(diffData.map(row => row['参照元ファイル']).filter(f => f))];
                console.log('参照元ファイル一覧:', referenceFiles);

                // 全ての参照元ファイルを並列で読み込み
                await Promise.all(referenceFiles.map(filename => loadDailyFile(filename)));

                // 差分種別が「削除」のものを成約済みとして抽出し、参照元ファイルから詳細を取得
                allSoldProperties = diffData
                    .filter(row => row['差分種別'] === '削除')
                    .map(row => {
                        const propertyId = row['物件番号'];
                        const referenceFile = row['参照元ファイル'];
                        const soldDate = row['差分検出日'] || '';
                        const diffId = row['差分ID'] || '';

                        // 参照元ファイルから物件詳細を取得
                        const dailyData = dailyFileCache[referenceFile];
                        const propertyDetail = dailyData ? dailyData[propertyId] : null;

                        if (!propertyDetail) {
                            console.warn(`物件詳細が見つかりません: ${propertyId} (${referenceFile})`);
                            return null;
                        }

                        const price = parsePrice(propertyDetail['価格']);
                        const areaSqm = parseArea(propertyDetail['専有面積']);
                        const areaTsubo = sqmToTsubo(areaSqm);
                        const age = calcAge(propertyDetail['築年月']);
                        const district = extractDistrict(propertyDetail['所在地']);
                        const tsuboPrice = areaTsubo > 0 ? price / areaTsubo : 0;
                        
                        return {
                            id: parseInt(propertyId) || 0,
                            diffId: diffId,
                            soldDate: soldDate,
                            referenceFile: referenceFile,
                            district: district,
                            building: propertyDetail['建物名'] || '',
                            floor: propertyDetail['所在階'] || '',
                            layout: propertyDetail['間取'] || '',
                            price: price,
                            priceStr: propertyDetail['価格'] || '',
                            area: areaTsubo,
                            areaSqm: areaSqm,
                            areaStr: areaTsubo.toFixed(2) + '坪',
                            age: age,
                            company: propertyDetail['商号'] || '',
                            torihiki: propertyDetail['取引態様'] || '',
                            tsuboPrice: tsuboPrice
                        };
                    })
                    .filter(d => d && d.id > 0);

                console.log(`成約済み物件: ${allSoldProperties.length}件読み込み完了`);

                // 差分種別が「更新」のものを抽出し、参照元ファイルから詳細を取得
                allUpdatedProperties = diffData
                    .filter(row => row['差分種別'] === '更新')
                    .map(row => {
                        const propertyId = row['物件番号'];
                        const referenceFile = row['参照元ファイル'];
                        const updateDate = row['差分検出日'] || '';
                        const diffId = row['差分ID'] || '';
                        const updateFieldCount = parseInt(row['更新フィールド数']) || 0;
                        const updateFieldList = row['更新フィールド一覧'] || '';

                        // 参照元ファイルから物件詳細を取得
                        const dailyData = dailyFileCache[referenceFile];
                        const propertyDetail = dailyData ? dailyData[propertyId] : null;

                        if (!propertyDetail) {
                            console.warn(`更新物件詳細が見つかりません: ${propertyId} (${referenceFile})`);
                            return null;
                        }
                        
                        return {
                            id: parseInt(propertyId) || 0,
                            diffId: diffId,
                            updateDate: updateDate,
                            referenceFile: referenceFile,
                            building: propertyDetail['建物名'] || '',
                            district: extractDistrict(propertyDetail['所在地']),
                            updateFieldCount: updateFieldCount,
                            updateFieldList: updateFieldList
                        };
                    })
                    .filter(d => d && d.id > 0);

                console.log(`更新物件: ${allUpdatedProperties.length}件読み込み完了`);

                // 更新詳細データを差分IDでグループ化
                allUpdateDetails = updatesData;
                
                // 更新物件リストの初期表示
                filteredUpdatedProperties = [...allUpdatedProperties].sort((a, b) => {
                    if (a.updateDate > b.updateDate) return -1;
                    if (a.updateDate < b.updateDate) return 1;
                    return 0;
                });
                renderUpdateList('yesterday');

                // 期間選択肢を生成
                initializePeriodSelector();

                // 初期は全期間
                periodFilteredSoldProperties = [...allSoldProperties];
                filteredSoldProperties = [...allSoldProperties].sort((a, b) => {
                    // 成約日の新しい順でデフォルトソート
                    if (a.soldDate > b.soldDate) return -1;
                    if (a.soldDate < b.soldDate) return 1;
                    return 0;
                });
                renderSoldList();

                // 売主成約統計データの初期化
                allSellerSoldProperties = allSoldProperties.filter(d => d.torihiki === '売主').map(d => {
                    return {
                        ...d,
                        soldDate: d.soldDate ? new Date(d.soldDate) : null,
                        unitPrice: d.tsuboPrice
                    };
                });
                sellerPeriodFilteredSoldProperties = [...allSellerSoldProperties];
                sellerFilteredSoldProperties = [...allSellerSoldProperties];

                // 売主成約統計フィルタの区・間取りオプション設定
                const sellerSoldDistricts = [...new Set(allSellerSoldProperties.map(d => d.district))].sort();
                const sellerSoldLayouts = [...new Set(allSellerSoldProperties.map(d => d.layout))].sort();

                const sellerSoldDistrictSelect = document.getElementById('seller-sold-filter-district');
                if (sellerSoldDistrictSelect) {
                    sellerSoldDistricts.forEach(d => {
                        const opt = document.createElement('option');
                        opt.value = d;
                        opt.textContent = d;
                        sellerSoldDistrictSelect.appendChild(opt);
                    });
                }

                const sellerSoldLayoutSelect = document.getElementById('seller-sold-filter-layout');
                if (sellerSoldLayoutSelect) {
                    sellerSoldLayouts.forEach(l => {
                        const opt = document.createElement('option');
                        opt.value = l;
                        opt.textContent = l;
                        sellerSoldLayoutSelect.appendChild(opt);
                    });
                }

                // 売主成約統計の初期表示
                updateSellerSoldStatsDisplay();
                updateSellerSoldCharts();
            } catch(e) {
                console.log('differences_master.csv読み込みエラー（ファイルが存在しない可能性）:', e);
                // ファイルがない場合は空で初期化
                allSoldProperties = [];
                periodFilteredSoldProperties = [];
                filteredSoldProperties = [];
                allSellerSoldProperties = [];
                sellerPeriodFilteredSoldProperties = [];
                sellerFilteredSoldProperties = [];
                allUpdatedProperties = [];
                allUpdateDetails = [];
                filteredUpdatedProperties = [];
                renderSoldList();
                renderUpdateList('yesterday');
            }
        }
        
        // 期間選択肢の初期化
        function initializePeriodSelector() {
            // データから日付の範囲を取得
            const dates = allSoldProperties.map(p => p.soldDate).filter(d => d).sort();
            if (dates.length === 0) return;
            
            // 週と月の選択肢を生成するための準備
            window.availableWeeks = getAvailableWeeks(dates);
            window.availableMonths = getAvailableMonths(dates);
        }
        
        // 利用可能な週のリストを取得
        function getAvailableWeeks(dates) {
            const weeks = new Set();
            dates.forEach(dateStr => {
                if (!dateStr) return;
                const date = new Date(dateStr);
                const weekInfo = getWeekInfo(date);
                weeks.add(JSON.stringify(weekInfo));
            });
            return Array.from(weeks).map(w => JSON.parse(w)).sort((a, b) => {
                if (a.year !== b.year) return b.year - a.year;
                if (a.month !== b.month) return b.month - a.month;
                return b.week - a.week;
            });
        }
        
        // 日付から年月週情報を取得
        function getWeekInfo(date) {
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const week = Math.ceil(day / 7);
            return { year, month, week };
        }
        
        // 週の開始日と終了日を取得
        function getWeekDateRange(weekInfo) {
            const { year, month, week } = weekInfo;
            const startDay = (week - 1) * 7 + 1;
            const lastDayOfMonth = new Date(year, month, 0).getDate();
            const endDay = Math.min(week * 7, lastDayOfMonth);
            
            const startDate = `${year}-${String(month).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
            const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
            return { startDate, endDate };
        }
        
        // 利用可能な月のリストを取得
        function getAvailableMonths(dates) {
            const months = new Set();
            dates.forEach(dateStr => {
                if (!dateStr) return;
                const [year, month] = dateStr.split('-');
                months.add(`${year}-${month}`);
            });
            return Array.from(months).sort().reverse();
        }
        
        // 期間単位変更
        function changePeriodUnit(unit) {
            currentPeriodUnit = unit;
            currentPeriodValue = null;
            
            // ボタンのアクティブ状態を更新
            document.querySelectorAll('.period-unit-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.unit === unit);
            });
            
            const container = document.getElementById('period-value-container');
            const inputContainer = document.getElementById('period-value-input');
            const label = document.getElementById('period-value-label');
            
            if (unit === 'all') {
                container.style.display = 'none';
                applyPeriodFilter();
                return;
            }
            
            container.style.display = 'block';
            
            if (unit === 'day') {
                label.textContent = '日付選択';
                inputContainer.innerHTML = '<input type="date" id="period-date-picker" onchange="onPeriodValueChange()">';
                // 最新の日付をデフォルトに
                const dates = allSoldProperties.map(p => p.soldDate).filter(d => d).sort().reverse();
                if (dates.length > 0) {
                    document.getElementById('period-date-picker').value = dates[0];
                    currentPeriodValue = dates[0];
                    applyPeriodFilter();
                }
            } else if (unit === 'week') {
                label.textContent = '週選択';
                const weeks = window.availableWeeks || [];
                let options = weeks.map(w => {
                    const value = `${w.year}-${w.month}-${w.week}`;
                    const label = `${w.year}年${w.month}月第${w.week}週目`;
                    return `<option value="${value}">${label}</option>`;
                }).join('');
                inputContainer.innerHTML = `<select id="period-week-picker" onchange="onPeriodValueChange()">${options}</select>`;
                if (weeks.length > 0) {
                    currentPeriodValue = `${weeks[0].year}-${weeks[0].month}-${weeks[0].week}`;
                    applyPeriodFilter();
                }
            } else if (unit === 'month') {
                label.textContent = '月選択';
                const months = window.availableMonths || [];
                let options = months.map(m => {
                    const [year, month] = m.split('-');
                    return `<option value="${m}">${year}年${parseInt(month)}月</option>`;
                }).join('');
                inputContainer.innerHTML = `<select id="period-month-picker" onchange="onPeriodValueChange()">${options}</select>`;
                if (months.length > 0) {
                    currentPeriodValue = months[0];
                    applyPeriodFilter();
                }
            }
        }
        
        // 期間値変更時
        function onPeriodValueChange() {
            if (currentPeriodUnit === 'day') {
                currentPeriodValue = document.getElementById('period-date-picker').value;
            } else if (currentPeriodUnit === 'week') {
                currentPeriodValue = document.getElementById('period-week-picker').value;
            } else if (currentPeriodUnit === 'month') {
                currentPeriodValue = document.getElementById('period-month-picker').value;
            }
            applyPeriodFilter();
        }
        
        // 期間フィルター適用
        function applyPeriodFilter() {
            let displayText = '全期間';
            
            if (currentPeriodUnit === 'all' || !currentPeriodValue) {
                periodFilteredSoldProperties = [...allSoldProperties];
                displayText = '全期間';
            } else if (currentPeriodUnit === 'day') {
                periodFilteredSoldProperties = allSoldProperties.filter(p => p.soldDate === currentPeriodValue);
                const [year, month, day] = currentPeriodValue.split('-');
                displayText = `${year}年${parseInt(month)}月${parseInt(day)}日`;
            } else if (currentPeriodUnit === 'week') {
                const [year, month, week] = currentPeriodValue.split('-').map(Number);
                const { startDate, endDate } = getWeekDateRange({ year, month, week });
                periodFilteredSoldProperties = allSoldProperties.filter(p => 
                    p.soldDate >= startDate && p.soldDate <= endDate
                );
                displayText = `${year}年${month}月第${week}週目`;
            } else if (currentPeriodUnit === 'month') {
                const [year, month] = currentPeriodValue.split('-');
                periodFilteredSoldProperties = allSoldProperties.filter(p => 
                    p.soldDate && p.soldDate.startsWith(`${year}-${month}`)
                );
                displayText = `${year}年${parseInt(month)}月`;
            }
            
            // 表示期間を更新
            document.getElementById('period-display-value').textContent = displayText;
            
            // 検索条件フィルターをリセットして適用
            resetSoldFilter();
        }

        // 成約済み物件フィルター適用
        function applySoldFilter() {
            const torihiki = document.getElementById('sold-filter-torihiki').value;
            const district = document.getElementById('sold-filter-district').value;
            const building = document.getElementById('sold-filter-building').value.toLowerCase();
            const layout = document.getElementById('sold-filter-layout').value;
            const priceRange = parseRangeValue(document.getElementById('sold-filter-price').value);
            const areaRange = parseRangeValue(document.getElementById('sold-filter-area').value);
            const ageRange = parseRangeValue(document.getElementById('sold-filter-age').value);

            // 期間フィルター済みデータからさらにフィルター
            filteredSoldProperties = periodFilteredSoldProperties.filter(p => {
                // 取引態様フィルター
                if (torihiki && p.torihiki !== torihiki) return false;
                // 区フィルター
                if (district && p.district !== district) return false;
                // 建物名フィルター
                if (building && !p.building.toLowerCase().includes(building)) return false;
                // 間取フィルター
                if (layout && !normalizeLayout(p.layout).includes(layout)) return false;
                // 価格フィルター
                if (p.price < priceRange.min || p.price > priceRange.max) return false;
                // 面積フィルター
                if (p.area < areaRange.min || p.area > areaRange.max) return false;
                // 築年数フィルター
                if (p.age >= 0 && (p.age < ageRange.min || p.age > ageRange.max)) return false;
                return true;
            });

            // フィルターバッジ表示
            const badge = document.getElementById('sold-filter-badge');
            const totalCount = periodFilteredSoldProperties.length;
            const filteredCount = filteredSoldProperties.length;
            
            if (filteredCount < totalCount) {
                badge.style.display = 'inline-flex';
                document.getElementById('sold-filtered-count').textContent = formatNumber(filteredCount);
                document.getElementById('sold-total-count').textContent = formatNumber(totalCount);
            } else {
                badge.style.display = 'none';
            }

            soldCurrentPage = 1;
            sortSoldList();
        }

        // 成約済み物件フィルターリセット
        function resetSoldFilter() {
            document.getElementById('sold-filter-torihiki').value = '';
            document.getElementById('sold-filter-district').value = '';
            document.getElementById('sold-filter-building').value = '';
            document.getElementById('sold-filter-layout').value = '';
            document.getElementById('sold-filter-price').value = '';
            document.getElementById('sold-filter-area').value = '';
            document.getElementById('sold-filter-age').value = '';
            
            // フィルターバッジを非表示
            document.getElementById('sold-filter-badge').style.display = 'none';
            
            filteredSoldProperties = [...periodFilteredSoldProperties];
            soldCurrentPage = 1;
            sortSoldList();
        }

        // 成約済み物件リスト描画
        function renderSoldList() {
            const tbody = document.getElementById('soldListBody');
            const totalCount = filteredSoldProperties.length;
            const totalPages = Math.ceil(totalCount / itemsPerPage);
            const start = (soldCurrentPage - 1) * itemsPerPage;
            const end = start + itemsPerPage;
            const pageData = filteredSoldProperties.slice(start, end);

            document.getElementById('sold-result-count').textContent = formatNumber(totalCount);

            if (totalCount === 0) {
                tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text-secondary);padding:40px;">成約済み物件データがありません</td></tr>';
                document.getElementById('sold-pagination').innerHTML = '';
                return;
            }

            tbody.innerHTML = pageData.map(p => {
                return `<tr><td>${p.soldDate}</td><td>${p.id}</td><td>${p.district}</td><td>${p.building}</td><td>${p.floor}</td><td>${p.layout}</td><td class="text-right">${p.priceStr}</td><td class="text-right">${p.areaStr}</td><td class="text-right">${p.age >= 0 ? p.age + '年' : '-'}</td><td>${p.company}</td></tr>`;
            }).join('');

            renderSoldPagination(totalPages);
            
            // 統計グラフを更新
            updateSoldStats();
        }

        // 成約済み物件統計・グラフ更新
        function updateSoldStats() {
            const data = filteredSoldProperties;
            
            if (data.length === 0) {
                document.getElementById('sold-stat-count').textContent = '0';
                document.getElementById('sold-stat-total').textContent = '-';
                document.getElementById('sold-stat-avg-price').textContent = '-';
                document.getElementById('sold-stat-price-detail').textContent = '-';
                document.getElementById('sold-stat-avg-sqm').textContent = '-';
                document.getElementById('sold-stat-sqm-detail').textContent = '-';
                return;
            }

            // サマリー統計
            const totalCount = data.length;
            const totalAmount = data.reduce((sum, d) => sum + d.price, 0);
            const avgPrice = totalAmount / totalCount;
            const prices = data.map(d => d.price).sort((a, b) => a - b);
            const medianPrice = prices[Math.floor(prices.length / 2)];
            
            // 坪単価計算（areaは既に坪単位）
            const tsuboPrices = data.filter(d => d.area > 0).map(d => d.price / d.area);
            const avgTsuboPrice = tsuboPrices.length > 0 ? tsuboPrices.reduce((a, b) => a + b, 0) / tsuboPrices.length : 0;
            const sortedTsubo = [...tsuboPrices].sort((a, b) => a - b);
            const medianTsuboPrice = sortedTsubo.length > 0 ? sortedTsubo[Math.floor(sortedTsubo.length / 2)] : 0;

            document.getElementById('sold-stat-count').textContent = formatNumber(totalCount);
            document.getElementById('sold-stat-total').textContent = (totalAmount / 10000).toFixed(1);
            document.getElementById('sold-stat-avg-price').textContent = formatNumber(Math.round(avgPrice)) + '万円';
            document.getElementById('sold-stat-price-detail').innerHTML = `中央値: ${formatNumber(medianPrice)}万円`;
            document.getElementById('sold-stat-avg-sqm').textContent = avgTsuboPrice.toFixed(1) + '万円';
            document.getElementById('sold-stat-sqm-detail').innerHTML = `中央値: ${medianTsuboPrice.toFixed(1)}万円`;

            // 区別成約件数・総額グラフ
            const districtStats = {};
            districts.forEach(d => { districtStats[d] = { count: 0, total: 0 }; });
            data.forEach(d => {
                if (districtStats[d.district]) {
                    districtStats[d.district].count++;
                    districtStats[d.district].total += d.price;
                }
            });

            // 区別在庫物件数を計算
            const districtInventory = {};
            districts.forEach(d => { districtInventory[d] = 0; });
            allRawData.forEach(d => {
                if (districtInventory[d.district] !== undefined) {
                    districtInventory[d.district]++;
                }
            });

            // 区別の成約率（在庫に占める割合）を計算
            const districtSoldRatio = districts.map(d => {
                const inventory = districtInventory[d];
                const sold = districtStats[d].count;
                return inventory > 0 ? (sold / inventory * 100) : 0;
            });

            if (soldDistrictChartInstance) soldDistrictChartInstance.destroy();
            soldDistrictChartInstance = new Chart(document.getElementById('soldDistrictChart'), {
                type: 'bar',
                data: {
                    labels: districts,
                    datasets: [
                        {
                            label: '成約件数',
                            data: districts.map(d => districtStats[d].count),
                            backgroundColor: districts.map(d => districtColors[d]),
                            yAxisID: 'y'
                        },
                        {
                            label: '在庫に占める割合(%)',
                            data: districtSoldRatio,
                            type: 'line',
                            borderColor: 'rgba(199, 91, 91, 1)',
                            backgroundColor: 'rgba(199, 91, 91, 0.1)',
                            yAxisID: 'y1',
                            tension: 0.3,
                            pointBackgroundColor: 'rgba(199, 91, 91, 1)',
                            pointRadius: 5
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'top' } },
                    scales: {
                        y: { beginAtZero: true, position: 'left', title: { display: true, text: '成約件数 (件)' } },
                        y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: '在庫に占める割合 (%)' } }
                    }
                }
            });

            // 価格帯別成約件数（仕入れ判断に重要）
            const priceRanges = {
                '～3,000': 0, '3,000～5,000': 0, '5,000～7,000': 0, '7,000～10,000': 0,
                '10,000～15,000': 0, '15,000～20,000': 0, '20,000～30,000': 0, '30,000～': 0
            };
            data.forEach(d => {
                if (d.price < 3000) priceRanges['～3,000']++;
                else if (d.price < 5000) priceRanges['3,000～5,000']++;
                else if (d.price < 7000) priceRanges['5,000～7,000']++;
                else if (d.price < 10000) priceRanges['7,000～10,000']++;
                else if (d.price < 15000) priceRanges['10,000～15,000']++;
                else if (d.price < 20000) priceRanges['15,000～20,000']++;
                else if (d.price < 30000) priceRanges['20,000～30,000']++;
                else priceRanges['30,000～']++;
            });

            if (soldPriceRangeChartInstance) soldPriceRangeChartInstance.destroy();
            soldPriceRangeChartInstance = new Chart(document.getElementById('soldPriceRangeChart'), {
                type: 'bar',
                data: {
                    labels: Object.keys(priceRanges),
                    datasets: [{
                        label: '成約件数',
                        data: Object.values(priceRanges),
                        backgroundColor: 'rgba(201, 169, 98, 0.8)',
                        borderColor: 'rgba(201, 169, 98, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                        legend: { display: false }
                    },
                    scales: {
                        x: { title: { display: true, text: '価格帯 (万円)' } },
                        y: { beginAtZero: true, title: { display: true, text: '成約件数 (件)' } }
                    }
                }
            });

            // 成約推移（日別）- マーケットの動きを把握
            const dateStats = {};
            data.forEach(d => {
                if (d.soldDate) {
                    if (!dateStats[d.soldDate]) {
                        dateStats[d.soldDate] = { count: 0, total: 0 };
                    }
                    dateStats[d.soldDate].count++;
                    dateStats[d.soldDate].total += d.price;
                }
            });
            const sortedDates = Object.keys(dateStats).sort();

            if (soldTrendChartInstance) soldTrendChartInstance.destroy();
            soldTrendChartInstance = new Chart(document.getElementById('soldTrendChart'), {
                type: 'line',
                data: {
                    labels: sortedDates,
                    datasets: [
                        {
                            label: '成約件数',
                            data: sortedDates.map(d => dateStats[d].count),
                            borderColor: 'rgba(5, 31, 50, 1)',
                            backgroundColor: 'rgba(5, 31, 50, 0.1)',
                            fill: true,
                            tension: 0.3,
                            yAxisID: 'y'
                        },
                        {
                            label: '成約総額(億円)',
                            data: sortedDates.map(d => dateStats[d].total / 10000),
                            borderColor: 'rgba(45, 139, 122, 1)',
                            backgroundColor: 'rgba(45, 139, 122, 0.1)',
                            fill: false,
                            tension: 0.3,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'top' } },
                    scales: {
                        x: { title: { display: true, text: '成約日' } },
                        y: { beginAtZero: true, position: 'left', title: { display: true, text: '件数' } },
                        y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: '総額(億円)' } }
                    }
                }
            });

            // 間取別成約分布
            // まず在庫物件の間取別件数を計算
            const layoutInventory = {};
            allRawData.forEach(d => {
                const layout = d.layout || '不明';
                if (!layoutInventory[layout]) layoutInventory[layout] = 0;
                layoutInventory[layout]++;
            });

            // 成約物件の間取別件数を計算
            const layoutSold = {};
            data.forEach(d => {
                const layout = d.layout || '不明';
                if (!layoutSold[layout]) layoutSold[layout] = 0;
                layoutSold[layout]++;
            });

            // 全ての間取をマージして件数順にソート
            const allLayouts = [...new Set([...Object.keys(layoutInventory), ...Object.keys(layoutSold)])];
            const layoutData = allLayouts.map(layout => ({
                layout: layout,
                sold: layoutSold[layout] || 0,
                inventory: layoutInventory[layout] || 0,
                ratio: layoutInventory[layout] > 0 ? ((layoutSold[layout] || 0) / layoutInventory[layout] * 100) : 0
            })).sort((a, b) => b.sold - a.sold).slice(0, 12); // 上位12件まで表示

            if (soldLayoutChartInstance) soldLayoutChartInstance.destroy();
            soldLayoutChartInstance = new Chart(document.getElementById('soldLayoutChart'), {
                type: 'bar',
                data: {
                    labels: layoutData.map(d => d.layout),
                    datasets: [
                        {
                            label: '成約件数',
                            data: layoutData.map(d => d.sold),
                            backgroundColor: 'rgba(74, 111, 165, 0.8)',
                            borderColor: 'rgba(74, 111, 165, 1)',
                            borderWidth: 1,
                            yAxisID: 'y'
                        },
                        {
                            label: '在庫に占める割合(%)',
                            data: layoutData.map(d => d.ratio),
                            type: 'line',
                            borderColor: 'rgba(199, 91, 91, 1)',
                            backgroundColor: 'rgba(199, 91, 91, 0.1)',
                            yAxisID: 'y1',
                            tension: 0.3,
                            pointBackgroundColor: 'rgba(199, 91, 91, 1)',
                            pointRadius: 5
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                        legend: { position: 'top' },
                        title: { display: true, text: '間取別の成約傾向と在庫比率', font: { size: 12 } }
                    },
                    scales: {
                        y: { beginAtZero: true, position: 'left', title: { display: true, text: '成約件数 (件)' } },
                        y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: '在庫に占める割合 (%)' } }
                    }
                }
            });

            // 面積帯別成約件数（需要の高い面積帯を把握）- 坪単位
            const areaRanges = {
                '～10坪': 0, '10～15坪': 0, '15～20坪': 0, '20～30坪': 0, '30坪～': 0
            };
            data.forEach(d => {
                if (d.area <= 10) areaRanges['～10坪']++;
                else if (d.area <= 15) areaRanges['10～15坪']++;
                else if (d.area <= 20) areaRanges['15～20坪']++;
                else if (d.area <= 30) areaRanges['20～30坪']++;
                else areaRanges['30坪～']++;
            });

            if (soldAreaRangeChartInstance) soldAreaRangeChartInstance.destroy();
            soldAreaRangeChartInstance = new Chart(document.getElementById('soldAreaRangeChart'), {
                type: 'doughnut',
                data: {
                    labels: Object.keys(areaRanges),
                    datasets: [{
                        data: Object.values(areaRanges),
                        backgroundColor: [
                            'rgba(5, 31, 50, 0.85)',
                            'rgba(15, 76, 117, 0.85)',
                            'rgba(45, 139, 122, 0.85)',
                            'rgba(201, 169, 98, 0.85)',
                            'rgba(139, 115, 85, 0.85)'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right' },
                        title: { display: true, text: '需要の高い面積帯（坪）', font: { size: 12 } }
                    }
                }
            });

            // 専有面積（坪） vs 価格 散布図（成約物件）
            if (soldScatterAreaChartInstance) soldScatterAreaChartInstance.destroy();
            soldScatterAreaChartInstance = new Chart(document.getElementById('soldScatterAreaChart'), {
                type: 'scatter',
                data: {
                    datasets: districts.map(district => ({
                        label: district,
                        data: data.filter(d => d.district === district).map(d => ({ x: d.area, y: d.price })),
                        backgroundColor: districtColors[district],
                        pointRadius: 4
                    }))
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: true, position: 'top', labels: { boxWidth: 12 } }
                    },
                    scales: {
                        x: { title: { display: true, text: '専有面積 (坪)' } },
                        y: { title: { display: true, text: '価格 (万円)' } }
                    }
                }
            });

            // 商号別成約ランキング
            const sellerStats = {};
            data.forEach(d => {
                const company = d.company || '不明';
                if (!sellerStats[company]) {
                    sellerStats[company] = { count: 0, total: 0 };
                }
                sellerStats[company].count++;
                sellerStats[company].total += d.price;
            });

            // 総額順TOP15
            const sellerByTotal = Object.entries(sellerStats)
                .map(([company, stats]) => ({ company, ...stats }))
                .sort((a, b) => b.total - a.total)
                .slice(0, 15);

            // 件数順TOP15
            const sellerByCount = Object.entries(sellerStats)
                .map(([company, stats]) => ({ company, ...stats }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 15);

            if (soldSellerTotalChartInstance) soldSellerTotalChartInstance.destroy();
            soldSellerTotalChartInstance = new Chart(document.getElementById('soldSellerTotalChart'), {
                type: 'bar',
                data: {
                    labels: sellerByTotal.map(d => d.company.substring(0, 12) + (d.company.length > 12 ? '...' : '')),
                    datasets: [{
                        label: '成約総額(億円)',
                        data: sellerByTotal.map(d => d.total / 10000),
                        backgroundColor: 'rgba(201, 169, 98, 0.8)',
                        borderColor: 'rgba(201, 169, 98, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                afterLabel: function(context) {
                                    const idx = context.dataIndex;
                                    return `件数: ${sellerByTotal[idx].count}件`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: { beginAtZero: true, title: { display: true, text: '成約総額 (億円)' } }
                    }
                }
            });

            if (soldSellerCountChartInstance) soldSellerCountChartInstance.destroy();
            soldSellerCountChartInstance = new Chart(document.getElementById('soldSellerCountChart'), {
                type: 'bar',
                data: {
                    labels: sellerByCount.map(d => d.company.substring(0, 12) + (d.company.length > 12 ? '...' : '')),
                    datasets: [{
                        label: '成約件数',
                        data: sellerByCount.map(d => d.count),
                        backgroundColor: 'rgba(45, 139, 122, 0.8)',
                        borderColor: 'rgba(45, 139, 122, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                afterLabel: function(context) {
                                    const idx = context.dataIndex;
                                    return `総額: ${(sellerByCount[idx].total / 10000).toFixed(1)}億円`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: { beginAtZero: true, title: { display: true, text: '成約件数' } }
                    }
                }
            });
        }

        // 成約済み物件リスト用フィルター適用
        function applySoldListFilter() {
            const district = document.getElementById('sold-list-filter-district').value;
            const building = document.getElementById('sold-list-filter-building').value.toLowerCase();
            const company = document.getElementById('sold-list-filter-company').value.toLowerCase();
            const layout = document.getElementById('sold-list-filter-layout').value;
            const priceRange = parseRangeValue(document.getElementById('sold-list-filter-price').value);
            const areaRange = parseRangeValue(document.getElementById('sold-list-filter-area').value);
            const ageRange = parseRangeValue(document.getElementById('sold-list-filter-age').value);

            filteredSoldProperties = allSoldProperties.filter(p => {
                if (district && p.district !== district) return false;
                if (building && !p.building.toLowerCase().includes(building)) return false;
                if (company && !p.company.toLowerCase().includes(company)) return false;
                if (layout && !normalizeLayout(p.layout).includes(layout)) return false;
                if (p.price < priceRange.min || p.price > priceRange.max) return false;
                if (p.area < areaRange.min || p.area > areaRange.max) return false;
                if (p.age >= 0 && (p.age < ageRange.min || p.age > ageRange.max)) return false;
                return true;
            });

            // フィルター通知表示
            const totalCount = allSoldProperties.length;
            const filteredCount = filteredSoldProperties.length;
            if (filteredCount < totalCount) {
                document.getElementById('sold-list-filter-notice').textContent = `(フィルター適用中: 全${formatNumber(totalCount)}件中)`;
            } else {
                document.getElementById('sold-list-filter-notice').textContent = '';
            }

            soldCurrentPage = 1;
            sortSoldList();
        }

        // 成約済み物件リスト用フィルターリセット
        function resetSoldListFilter() {
            document.getElementById('sold-list-filter-district').value = '';
            document.getElementById('sold-list-filter-building').value = '';
            document.getElementById('sold-list-filter-company').value = '';
            document.getElementById('sold-list-filter-layout').value = '';
            document.getElementById('sold-list-filter-price').value = '';
            document.getElementById('sold-list-filter-area').value = '';
            document.getElementById('sold-list-filter-age').value = '';
            document.getElementById('sold-list-filter-notice').textContent = '';
            filteredSoldProperties = [...allSoldProperties];
            soldCurrentPage = 1;
            sortSoldList();
        }

        // 成約済み物件ソート
        function sortSoldList() {
            const sortValue = document.getElementById('sold-sort-select').value;
            const [field, order] = sortValue.split('-');
            filteredSoldProperties.sort((a, b) => {
                let valA, valB;
                if (field === 'id') { valA = a.id; valB = b.id; }
                else if (field === 'price') { valA = a.price; valB = b.price; }
                else if (field === 'soldDate') { valA = a.soldDate; valB = b.soldDate; }
                
                if (field === 'soldDate') {
                    // 日付文字列の比較
                    if (valA > valB) return order === 'asc' ? 1 : -1;
                    if (valA < valB) return order === 'asc' ? -1 : 1;
                    return 0;
                }
                return order === 'asc' ? valA - valB : valB - valA;
            });
            soldCurrentPage = 1;
            renderSoldList();
        }

        // 成約済み物件ページネーション描画
        function renderSoldPagination(totalPages) {
            const container = document.getElementById('sold-pagination');
            if (totalPages <= 1) { container.innerHTML = ''; return; }
            
            let html = `<button onclick="goToSoldPage(${soldCurrentPage - 1})" ${soldCurrentPage === 1 ? 'disabled' : ''}>← 前へ</button>`;
            const maxButtons = 5;
            let startPage = Math.max(1, soldCurrentPage - Math.floor(maxButtons / 2));
            let endPage = Math.min(totalPages, startPage + maxButtons - 1);
            if (endPage - startPage < maxButtons - 1) startPage = Math.max(1, endPage - maxButtons + 1);

            if (startPage > 1) html += `<button onclick="goToSoldPage(1)">1</button><span>...</span>`;
            for (let i = startPage; i <= endPage; i++) {
                html += `<button onclick="goToSoldPage(${i})" class="${i === soldCurrentPage ? 'active' : ''}">${i}</button>`;
            }
            if (endPage < totalPages) html += `<span>...</span><button onclick="goToSoldPage(${totalPages})">${totalPages}</button>`;
            html += `<button onclick="goToSoldPage(${soldCurrentPage + 1})" ${soldCurrentPage === totalPages ? 'disabled' : ''}>次へ →</button>`;
            container.innerHTML = html;
        }

        function goToSoldPage(page) { soldCurrentPage = page; renderSoldList(); }

        // 成約済み物件CSV出力
        function exportSoldCSV() {
            const headers = ['成約日','物件番号','区','建物名','所在階','間取','価格','専有面積(坪)','築年数','商号'];
            const rows = filteredSoldProperties.map(p => [p.soldDate, p.id, p.district, p.building, p.floor, p.layout, p.priceStr, p.areaStr, p.age >= 0 ? p.age : '', p.company]);
            const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
            const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'sold_properties.csv';
            link.click();
            showToast(`${filteredSoldProperties.length}件のデータをエクスポートしました`);
        }

        // フィルターアコーディオントグル
        function toggleFilter(sectionId) {
            const section = document.getElementById(sectionId);
            if (section) {
                section.classList.toggle('collapsed');
                // コンテンツの高さを設定
                const content = section.querySelector('.filter-content');
                if (content) {
                    if (section.classList.contains('collapsed')) {
                        content.style.maxHeight = '0';
                    } else {
                        content.style.maxHeight = content.scrollHeight + 'px';
                    }
                }
            }
        }

        // レスポンシブ時のフィルター初期化
        function initFilterAccordions() {
            const isMobile = window.innerWidth <= 768;
            document.querySelectorAll('.filter-section').forEach(section => {
                const content = section.querySelector('.filter-content');
                if (content) {
                    if (isMobile) {
                        // モバイルでは閉じた状態で開始
                        section.classList.add('collapsed');
                        content.style.maxHeight = '0';
                    } else {
                        // デスクトップでは開いた状態
                        section.classList.remove('collapsed');
                        content.style.maxHeight = 'none';
                    }
                }
            });
        }

        // ウィンドウリサイズ時の処理（幅が大きく変わった時のみアコーディオン初期化）
        let lastWindowWidth = window.innerWidth;
        window.addEventListener('resize', () => {
            // 幅の変化が100px以上の場合のみ（orientation変更等）
            if (Math.abs(window.innerWidth - lastWindowWidth) > 100) {
                initFilterAccordions();
                lastWindowWidth = window.innerWidth;
            }
        });

        // スクロールトップ
        function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
        window.addEventListener('scroll', () => {
            const btn = document.querySelector('.back-to-top-btn');
            btn.style.display = window.scrollY > 300 ? 'block' : 'none';
        });

        // トースト通知
        function showToast(message, duration = 3000) {
            let toast = document.querySelector('.toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.className = 'toast';
                document.body.appendChild(toast);
            }
            toast.textContent = message;
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, duration);
        }

        // 初期化
        document.addEventListener('DOMContentLoaded', () => {
            loadData();
            initFilterAccordions();
        });