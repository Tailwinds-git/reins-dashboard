import csv
from pathlib import Path

# ファイルパス
old_file = Path('reins_20251207.csv')
new_file = Path('20251207/reins_data_merged_20251207_170705.csv')
output_file = Path('20251207/differences_master.csv')

# CSVを読み込み、物件番号をキーとした辞書を作成
def load_csv(filepath):
    data = {}
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            property_id = row.get('物件番号', '').strip()
            if property_id:
                data[property_id] = row
    return data

print(f"旧データ読み込み中: {old_file}")
old_data = load_csv(old_file)
print(f"  -> {len(old_data)}件")

print(f"新データ読み込み中: {new_file}")
new_data = load_csv(new_file)
print(f"  -> {len(new_data)}件")

# 削除された物件を検出（旧にあって新にない）
deleted_ids = set(old_data.keys()) - set(new_data.keys())
print(f"\n削除された物件（成約済み）: {len(deleted_ids)}件")

# 出力用ヘッダー
output_headers = [
    'No', '物件番号', '物件種目', '専有面積', '所在地', '取引態様', '価格',
    '用途地域', '㎡単価', '建物名', '所在階', '間取', '取引状況', '管理費',
    '坪単価', '沿線駅', '交通', '商号', '築年月', '電話番号', '差分種別', '差分検出日'
]

# 差分ファイル出力
with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(output_headers)

    for property_id in sorted(deleted_ids):
        row = old_data[property_id]
        output_row = [
            row.get('No', ''),
            row.get('物件番号', ''),
            row.get('物件種目', ''),
            row.get('専有面積', ''),
            row.get('所在地', ''),
            row.get('取引態様', ''),
            row.get('価格', ''),
            row.get('用途地域', ''),
            row.get('㎡単価', ''),
            row.get('建物名', ''),
            row.get('所在階', ''),
            row.get('間取', ''),
            row.get('取引状況', ''),
            row.get('管理費', ''),
            row.get('坪単価', ''),
            row.get('沿線駅', ''),
            row.get('交通', ''),
            row.get('商号', ''),
            row.get('築年月', ''),
            row.get('電話番号', ''),
            '削除',
            '2025-12-07'
        ]
        writer.writerow(output_row)

print(f"\n出力完了: {output_file}")
print(f"  -> {len(deleted_ids)}件の削除レコードを出力")
