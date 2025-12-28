"""
DailyApp 관리 프로그램
클릭으로 실행/자동화 관리
"""

import tkinter as tk
from tkinter import messagebox
import subprocess
import os
import threading

# 프로젝트 경로
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))

class DailyAppManager:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("DailyApp 관리")
        self.root.geometry("350x400")
        self.root.resizable(False, False)
        self.root.configure(bg="#1a1a2e")

        # 아이콘 설정 (있으면)
        try:
            self.root.iconbitmap(os.path.join(PROJECT_DIR, "icon.ico"))
        except:
            pass

        self.create_widgets()
        self.center_window()

    def center_window(self):
        self.root.update_idletasks()
        x = (self.root.winfo_screenwidth() - 350) // 2
        y = (self.root.winfo_screenheight() - 400) // 2
        self.root.geometry(f"350x400+{x}+{y}")

    def create_widgets(self):
        # 제목
        title = tk.Label(
            self.root,
            text="DailyApp",
            font=("맑은 고딕", 24, "bold"),
            fg="#e94560",
            bg="#1a1a2e"
        )
        title.pack(pady=(30, 5))

        subtitle = tk.Label(
            self.root,
            text="앱 아이디어 리포터",
            font=("맑은 고딕", 11),
            fg="#888888",
            bg="#1a1a2e"
        )
        subtitle.pack(pady=(0, 30))

        # 상태 표시
        self.status_label = tk.Label(
            self.root,
            text="",
            font=("맑은 고딕", 10),
            fg="#4ecca3",
            bg="#1a1a2e"
        )
        self.status_label.pack(pady=(0, 20))
        self.update_status()

        # 버튼 스타일
        btn_style = {
            "font": ("맑은 고딕", 12),
            "width": 25,
            "height": 2,
            "cursor": "hand2",
            "bd": 0,
            "activeforeground": "white"
        }

        # 지금 실행 버튼
        btn_run = tk.Button(
            self.root,
            text="▶  지금 실행",
            bg="#4ecca3",
            fg="white",
            activebackground="#3db892",
            command=self.run_now,
            **btn_style
        )
        btn_run.pack(pady=8)

        # 자동실행 켜기 버튼
        btn_enable = tk.Button(
            self.root,
            text="⏰  자동실행 켜기 (매일 9시)",
            bg="#0f4c75",
            fg="white",
            activebackground="#0d3d5f",
            command=self.enable_schedule,
            **btn_style
        )
        btn_enable.pack(pady=8)

        # 자동실행 끄기 버튼
        btn_disable = tk.Button(
            self.root,
            text="⏸  자동실행 끄기",
            bg="#3d3d3d",
            fg="white",
            activebackground="#2d2d2d",
            command=self.disable_schedule,
            **btn_style
        )
        btn_disable.pack(pady=8)

        # 종료 버튼
        btn_exit = tk.Button(
            self.root,
            text="종료",
            bg="#1a1a2e",
            fg="#666666",
            activebackground="#1a1a2e",
            font=("맑은 고딕", 10),
            width=10,
            cursor="hand2",
            bd=0,
            command=self.root.quit
        )
        btn_exit.pack(pady=(20, 0))

    def update_status(self):
        """스케줄러 상태 확인"""
        try:
            result = subprocess.run(
                ['schtasks', '/query', '/tn', 'DailyAppReport', '/fo', 'list'],
                capture_output=True,
                text=True,
                creationflags=subprocess.CREATE_NO_WINDOW
            )
            if "사용" in result.stdout or "Ready" in result.stdout or "Enabled" in result.stdout:
                self.status_label.config(text="자동실행: 켜짐 (매일 09:00)", fg="#4ecca3")
            elif "사용 안 함" in result.stdout or "Disabled" in result.stdout:
                self.status_label.config(text="자동실행: 꺼짐", fg="#888888")
            else:
                self.status_label.config(text="자동실행: 설정 안됨", fg="#888888")
        except:
            self.status_label.config(text="자동실행: 설정 안됨", fg="#888888")

    def run_now(self):
        """지금 실행"""
        def task():
            self.status_label.config(text="실행 중...", fg="#e94560")
            self.root.update()

            try:
                # daily.bat 실행
                bat_path = os.path.join(PROJECT_DIR, "daily.bat")
                result = subprocess.run(
                    bat_path,
                    cwd=PROJECT_DIR,
                    shell=True,
                    capture_output=True,
                    text=True
                )

                if result.returncode == 0:
                    self.root.after(0, lambda: messagebox.showinfo("완료", "실행이 완료되었습니다!\n카카오톡을 확인하세요."))
                else:
                    self.root.after(0, lambda: messagebox.showerror("오류", f"실행 중 오류 발생:\n{result.stderr[:200]}"))
            except Exception as e:
                self.root.after(0, lambda: messagebox.showerror("오류", f"오류: {str(e)}"))
            finally:
                self.root.after(0, self.update_status)

        threading.Thread(target=task, daemon=True).start()

    def enable_schedule(self):
        """자동실행 켜기"""
        try:
            result = subprocess.run(
                ['schtasks', '/change', '/tn', 'DailyAppReport', '/enable'],
                capture_output=True,
                text=True,
                creationflags=subprocess.CREATE_NO_WINDOW
            )
            if result.returncode == 0:
                messagebox.showinfo("완료", "자동실행이 켜졌습니다.\n매일 아침 9시에 실행됩니다.")
            else:
                messagebox.showerror("오류", "스케줄이 등록되지 않았습니다.\n먼저 관리.bat로 스케줄을 생성하세요.")
        except Exception as e:
            messagebox.showerror("오류", f"오류: {str(e)}")
        self.update_status()

    def disable_schedule(self):
        """자동실행 끄기"""
        try:
            result = subprocess.run(
                ['schtasks', '/change', '/tn', 'DailyAppReport', '/disable'],
                capture_output=True,
                text=True,
                creationflags=subprocess.CREATE_NO_WINDOW
            )
            if result.returncode == 0:
                messagebox.showinfo("완료", "자동실행이 꺼졌습니다.")
            else:
                messagebox.showinfo("알림", "스케줄이 등록되지 않았습니다.")
        except Exception as e:
            messagebox.showerror("오류", f"오류: {str(e)}")
        self.update_status()

    def run(self):
        self.root.mainloop()

if __name__ == "__main__":
    app = DailyAppManager()
    app.run()
