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
OUTPUT_FILE = Path('differences_master.csv')

# 出力用ヘッダー
OUTPUT_HEADERS = [
    'No', '物件番号', '物件種目', '専有面積', '所在地', '取引態様', '価格',
    '用途地域', '㎡単価', '建物名', '所在階', '間取', '取引状況', '管理費',
    '坪単価', '沿線駅', '交通', '商号', '築年月', '電話番号', '差分種別', '差分検出日'
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

def create_output_row(row, diff_type, detection_date):
    """出力用の行を作成（改行を除去）"""
    return [
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
        detection_date
    ]

def main():
    print("=" * 60)
    print("REINS物件データ 差分計算処理")
    print("=" * 60)
    
    all_differences = []
    
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
        
        # 削除された物件を検出（旧にあって新にない = 成約済み等）
        deleted_ids = old_ids - new_ids
        print(f"   🔴 削除（成約済み等）: {len(deleted_ids)}件")
        
        for property_id in sorted(deleted_ids):
            row = old_data[property_id]
            all_differences.append(create_output_row(row, '削除', detection_date))
        
        # 新規物件を検出（新にあって旧にない = 新規登録）
        added_ids = new_ids - old_ids
        print(f"   🟢 新規登録: {len(added_ids)}件")
        
        for property_id in sorted(added_ids):
            row = new_data[property_id]
            all_differences.append(create_output_row(row, '新規', detection_date))
    
    # 差分ファイル出力
    if all_differences:
        with open(OUTPUT_FILE, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(OUTPUT_HEADERS)
            
            # 検出日、差分種別、物件番号でソート
            all_differences.sort(key=lambda x: (x[-1], x[-2], x[1]))
            
            for row in all_differences:
                writer.writerow(row)
        
        print(f"\n" + "=" * 60)
        print(f"✅ 処理完了!")
        print(f"📁 出力ファイル: {OUTPUT_FILE}")
        print(f"📊 合計レコード数: {len(all_differences)}件")
        print("=" * 60)
        
        # 日別サマリー
        print("\n【日別サマリー】")
        date_summary = {}
        for row in all_differences:
            date = row[-1]
            diff_type = row[-2]
            if date not in date_summary:
                date_summary[date] = {'新規': 0, '削除': 0}
            date_summary[date][diff_type] += 1
        
        for date in sorted(date_summary.keys()):
            stats = date_summary[date]
            print(f"  {date}: 新規 {stats['新規']}件, 削除 {stats['削除']}件")
    else:
        print("\n⚠️ 差分は検出されませんでした。")

if __name__ == '__main__':
    main()