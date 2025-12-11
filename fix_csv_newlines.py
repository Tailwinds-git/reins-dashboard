#!/usr/bin/env python3
"""
CSVファイル内のフィールド内改行を除去するスクリプト

使い方:
    python fix_csv_newlines.py input.csv [output.csv]

例:
    python fix_csv_newlines.py reins_20251211.csv                     # 上書き保存
    python fix_csv_newlines.py reins_20251211.csv reins_fixed.csv     # 別名保存
"""

import csv
import sys
import os
import tempfile
import shutil


def fix_csv_newlines(input_path, output_path, replacement=' '):
    """
    CSVファイル内のフィールド内改行を指定文字（デフォルトはスペース）に置換する
    
    Args:
        input_path: 入力CSVファイルのパス
        output_path: 出力CSVファイルのパス
        replacement: 改行を置換する文字（デフォルト: スペース）
    """
    
    # 入力ファイルの存在確認
    if not os.path.exists(input_path):
        print(f"エラー: ファイルが見つかりません: {input_path}")
        sys.exit(1)
    
    # 入力と出力が同じファイルかどうか判定
    same_file = os.path.abspath(input_path) == os.path.abspath(output_path)
    
    # 統計情報
    total_rows = 0
    fixed_rows = 0
    total_newlines_removed = 0
    
    # 一時ファイルを使用（同一ファイルの場合も安全に処理）
    temp_fd, temp_path = tempfile.mkstemp(suffix='.csv')
    os.close(temp_fd)
    
    try:
        # CSVを読み込んで一時ファイルに処理結果を書き込み
        with open(input_path, 'r', encoding='utf-8-sig', newline='') as infile:
            reader = csv.reader(infile)
            
            with open(temp_path, 'w', encoding='utf-8-sig', newline='') as outfile:
                writer = csv.writer(outfile)
                
                for row in reader:
                    total_rows += 1
                    new_row = []
                    row_had_newline = False
                    
                    for field in row:
                        # フィールド内の改行をカウント
                        newline_count = field.count('\n') + field.count('\r')
                        
                        if newline_count > 0:
                            row_had_newline = True
                            total_newlines_removed += newline_count
                            # 改行を置換（\r\n, \n, \r すべて対応）
                            field = field.replace('\r\n', replacement)
                            field = field.replace('\n', replacement)
                            field = field.replace('\r', replacement)
                        
                        new_row.append(field)
                    
                    if row_had_newline:
                        fixed_rows += 1
                    
                    writer.writerow(new_row)
        
        # 一時ファイルを出力先に移動
        shutil.move(temp_path, output_path)
        
    except Exception as e:
        # エラー時は一時ファイルを削除
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise e
    
    # 結果を表示
    print(f"処理完了!")
    print(f"  入力ファイル: {input_path}")
    print(f"  出力ファイル: {output_path}" + (" (上書き)" if same_file else ""))
    print(f"  総行数: {total_rows:,}")
    print(f"  修正した行数: {fixed_rows:,}")
    print(f"  除去した改行数: {total_newlines_removed:,}")


def main():
    if len(sys.argv) < 2:
        print("使い方: python fix_csv_newlines.py <入力CSV> [出力CSV]")
        print("  出力CSVを省略すると、入力ファイルを上書き保存します")
        sys.exit(1)
    
    input_path = sys.argv[1]
    
    if len(sys.argv) >= 3:
        output_path = sys.argv[2]
    else:
        # 出力ファイルを省略した場合は上書き
        output_path = input_path
    
    fix_csv_newlines(input_path, output_path)


if __name__ == '__main__':
    main()