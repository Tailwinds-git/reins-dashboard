import csv
from pathlib import Path

# 差分計算の設定
# (旧ファイル, 新ファイル, 差分検出日) のリスト
COMPARISON_PAIRS = [
    ('reins_20251206.csv', 'reins_20251207.csv', '2025-12-07'),
    ('reins_20251207.csv', 'reins_20251208.csv', '2025-12-08'),
    ('reins_20251208.csv', 'reins_20251210.csv', '2025-12-10'),
    ('reins_20251210.csv', 'reins_20251212.csv', '2025-12-12'),
    ('reins_20251212.csv', 'reins_20251213.csv', '2025-12-13'),
    ('reins_20251212.csv', 'reins_20251214.csv', '2025-12-14'),
    ('reins_20251214.csv', 'reins_20251215.csv', '2025-12-15')
]

# 出力ファイル
OUTPUT_MASTER_FILE = Path('differences_master.csv')
OUTPUT_UPDATES_FILE = Path('differences_updates.csv')

# 出力用ヘッダー（master）
OUTPUT_MASTER_HEADERS = [
    '差分ID', 'No', '物件番号', '物件種目', '専有面積', '所在地', '取引態様', '価格',
    '用途地域', '㎡単価', '建物名', '所在階', '間取', '取引状況', '管理費',
    '坪単価', '沿線駅', '交通', '商号', '築年月', '電話番号', '差分種別', '差分検出日',
    '更新フィールド数', '更新フィールド一覧'
]

# 出力用ヘッダー（updates）
OUTPUT_UPDATES_HEADERS = [
    '差分ID', '物件番号', '差分検出日', '更新フィールド', '更新前', '更新後'
]

# 比較対象フィールド（更新検出に使用）
COMPARE_FIELDS = [
    'No', '物件種目', '専有面積', '所在地', '取引態様', '価格',
    '用途地域', '㎡単価', '建物名', '所在階', '間取', '取引状況', '管理費',
    '坪単価', '沿線駅', '交通', '商号', '築年月', '電話番号'
]


def sanitize_value(value):
    """
    値から改行を除去してCSVパースエラーを防ぐ
    改行は半角スペースに置換
    """
    if value is None:
        return ''
    # 改行（CR, LF, CRLF）をスペースに置換
    return str(value).replace('\r\n', ' ').replace('\r', ' ').replace('\n', ' ')


def load_csv(filepath):
    """CSVを読み込み、物件番号をキーとした辞書を作成"""
    data = {}
    try:
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                property_id = row.get('物件番号', '').strip()
                if property_id:
                    data[property_id] = row
    except FileNotFoundError:
        print(f"  ⚠️ ファイルが見つかりません: {filepath}")
        return None
    return data


def generate_diff_id(detection_date, sequence_num):
    """
    差分IDを生成（YYYYMMDD_NNN形式）
    例: 2025-12-07 + 1 -> 20251207_001
    """
    date_part = detection_date.replace('-', '')
    return f"{date_part}_{sequence_num:03d}"


def detect_changes(old_row, new_row):
    """
    2つの行を比較し、変更されたフィールドのリストを返す
    戻り値: [{'field': フィールド名, 'old': 旧値, 'new': 新値}, ...]
    """
    changes = []
    for field in COMPARE_FIELDS:
        old_val = sanitize_value(old_row.get(field, '')).strip()
        new_val = sanitize_value(new_row.get(field, '')).strip()
        if old_val != new_val:
            changes.append({
                'field': field,
                'old': old_val,
                'new': new_val
            })
    return changes


def create_master_row(diff_id, row, diff_type, detection_date, update_info=None):
    """
    master用の出力行を作成
    update_info: 更新の場合のみ {'count': 更新フィールド数, 'fields': 'フィールド一覧'}
    """
    update_count = ''
    update_fields = ''
    if update_info:
        update_count = update_info['count']
        update_fields = update_info['fields']
    
    return [
        diff_id,
        sanitize_value(row.get('No', '')),
        sanitize_value(row.get('物件番号', '')),
        sanitize_value(row.get('物件種目', '')),
        sanitize_value(row.get('専有面積', '')),
        sanitize_value(row.get('所在地', '')),
        sanitize_value(row.get('取引態様', '')),
        sanitize_value(row.get('価格', '')),
        sanitize_value(row.get('用途地域', '')),
        sanitize_value(row.get('㎡単価', '')),
        sanitize_value(row.get('建物名', '')),
        sanitize_value(row.get('所在階', '')),
        sanitize_value(row.get('間取', '')),
        sanitize_value(row.get('取引状況', '')),
        sanitize_value(row.get('管理費', '')),
        sanitize_value(row.get('坪単価', '')),
        sanitize_value(row.get('沿線駅', '')),
        sanitize_value(row.get('交通', '')),
        sanitize_value(row.get('商号', '')),
        sanitize_value(row.get('築年月', '')),
        sanitize_value(row.get('電話番号', '')),
        diff_type,
        detection_date,
        update_count,
        update_fields
    ]


def create_update_rows(diff_id, property_id, detection_date, changes):
    """
    updates用の出力行リストを作成（変更フィールドごとに1行）
    """
    rows = []
    for change in changes:
        rows.append([
            diff_id,
            property_id,
            detection_date,
            change['field'],
            change['old'],
            change['new']
        ])
    return rows


def main():
    print("=" * 60)
    print("REINS物件データ 差分計算処理")
    print("=" * 60)
    
    all_master_rows = []
    all_update_rows = []
    
    # 日付ごとの連番管理
    date_sequence = {}
    
    for old_file, new_file, detection_date in COMPARISON_PAIRS:
        print(f"\n📊 処理中: {old_file} → {new_file}")
        print(f"   検出日: {detection_date}")
        
        old_path = Path(old_file)
        new_path = Path(new_file)
        
        # CSVファイル読み込み
        print(f"   旧データ読み込み中: {old_file}")
        old_data = load_csv(old_path)
        if old_data is None:
            print(f"   ⏭️ スキップします")
            continue
        print(f"     -> {len(old_data)}件")
        
        print(f"   新データ読み込み中: {new_file}")
        new_data = load_csv(new_path)
        if new_data is None:
            print(f"   ⏭️ スキップします")
            continue
        print(f"     -> {len(new_data)}件")
        
        old_ids = set(old_data.keys())
        new_ids = set(new_data.keys())
        
        # 連番の初期化
        if detection_date not in date_sequence:
            date_sequence[detection_date] = 0
        
        # 削除された物件を検出（旧にあって新にない = 成約済み等）
        deleted_ids = old_ids - new_ids
        print(f"   🔴 削除（成約済み等）: {len(deleted_ids)}件")
        
        for property_id in sorted(deleted_ids):
            date_sequence[detection_date] += 1
            diff_id = generate_diff_id(detection_date, date_sequence[detection_date])
            row = old_data[property_id]
            all_master_rows.append(create_master_row(diff_id, row, '削除', detection_date))
        
        # 新規物件を検出（新にあって旧にない = 新規登録）
        added_ids = new_ids - old_ids
        print(f"   🟢 新規登録: {len(added_ids)}件")
        
        for property_id in sorted(added_ids):
            date_sequence[detection_date] += 1
            diff_id = generate_diff_id(detection_date, date_sequence[detection_date])
            row = new_data[property_id]
            all_master_rows.append(create_master_row(diff_id, row, '新規', detection_date))
        
        # 更新された物件を検出（共通の物件番号で内容が異なる）
        common_ids = old_ids & new_ids
        updated_count = 0
        
        for property_id in sorted(common_ids):
            old_row = old_data[property_id]
            new_row = new_data[property_id]
            
            changes = detect_changes(old_row, new_row)
            
            if changes:
                updated_count += 1
                date_sequence[detection_date] += 1
                diff_id = generate_diff_id(detection_date, date_sequence[detection_date])
                
                # 更新情報
                update_info = {
                    'count': len(changes),
                    'fields': '/'.join([c['field'] for c in changes])
                }
                
                # masterには新データ（更新後）の情報を格納
                all_master_rows.append(
                    create_master_row(diff_id, new_row, '更新', detection_date, update_info)
                )
                
                # updatesには変更詳細を格納
                all_update_rows.extend(
                    create_update_rows(diff_id, property_id, detection_date, changes)
                )
        
        print(f"   🟡 更新: {updated_count}件")
    
    # masterファイル出力
    if all_master_rows:
        with open(OUTPUT_MASTER_FILE, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(OUTPUT_MASTER_HEADERS)
            
            # 検出日、差分種別、物件番号でソート
            all_master_rows.sort(key=lambda x: (x[22], x[21], x[2]))  # 差分検出日, 差分種別, 物件番号
            
            for row in all_master_rows:
                writer.writerow(row)
        
        print(f"\n" + "=" * 60)
        print(f"✅ 処理完了!")
        print(f"📁 出力ファイル（master）: {OUTPUT_MASTER_FILE}")
        print(f"📊 合計レコード数: {len(all_master_rows)}件")
    
    # updatesファイル出力
    if all_update_rows:
        with open(OUTPUT_UPDATES_FILE, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(OUTPUT_UPDATES_HEADERS)
            
            # 差分ID、更新フィールドでソート
            all_update_rows.sort(key=lambda x: (x[0], x[3]))
            
            for row in all_update_rows:
                writer.writerow(row)
        
        print(f"📁 出力ファイル（updates）: {OUTPUT_UPDATES_FILE}")
        print(f"📊 更新詳細レコード数: {len(all_update_rows)}件")
    
    print("=" * 60)
    
    # 日別サマリー
    if all_master_rows:
        print("\n【日別サマリー】")
        date_summary = {}
        for row in all_master_rows:
            date = row[22]  # 差分検出日
            diff_type = row[21]  # 差分種別
            if date not in date_summary:
                date_summary[date] = {'新規': 0, '削除': 0, '更新': 0}
            date_summary[date][diff_type] += 1
        
        for date in sorted(date_summary.keys()):
            stats = date_summary[date]
            print(f"  {date}: 新規 {stats['新規']}件, 削除 {stats['削除']}件, 更新 {stats['更新']}件")
    else:
        print("\n⚠️ 差分は検出されませんでした。")


if __name__ == '__main__':
    main()