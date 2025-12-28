"""
DailyApp 관리 프로그램
실시간 로그 + 상태 표시
"""

import tkinter as tk
from tkinter import ttk, scrolledtext
import subprocess
import os
import threading
import queue
import time
from datetime import datetime

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))

class DailyAppManager:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("DailyApp Manager")
        self.root.geometry("500x650")
        self.root.resizable(False, False)
        self.root.configure(bg="#0f0f1a")

        self.log_queue = queue.Queue()
        self.is_running = False

        self.create_widgets()
        self.center_window()
        self.update_status()
        self.process_log_queue()

    def center_window(self):
        self.root.update_idletasks()
        x = (self.root.winfo_screenwidth() - 500) // 2
        y = (self.root.winfo_screenheight() - 650) // 2
        self.root.geometry(f"500x650+{x}+{y}")

    def create_widgets(self):
        # 헤더
        header_frame = tk.Frame(self.root, bg="#0f0f1a")
        header_frame.pack(fill="x", padx=20, pady=(20, 10))

        title = tk.Label(
            header_frame,
            text="DailyApp",
            font=("Segoe UI", 28, "bold"),
            fg="#e94560",
            bg="#0f0f1a"
        )
        title.pack(side="left")

        # 상태 인디케이터
        self.status_dot = tk.Label(
            header_frame,
            text="●",
            font=("Segoe UI", 14),
            fg="#888888",
            bg="#0f0f1a"
        )
        self.status_dot.pack(side="right", padx=(0, 5))

        self.status_text = tk.Label(
            header_frame,
            text="대기 중",
            font=("Segoe UI", 11),
            fg="#888888",
            bg="#0f0f1a"
        )
        self.status_text.pack(side="right")

        # 스케줄 상태 카드
        schedule_frame = tk.Frame(self.root, bg="#1a1a2e", highlightbackground="#2a2a4e", highlightthickness=1)
        schedule_frame.pack(fill="x", padx=20, pady=10)

        schedule_inner = tk.Frame(schedule_frame, bg="#1a1a2e")
        schedule_inner.pack(fill="x", padx=15, pady=12)

        tk.Label(
            schedule_inner,
            text="⏰ 자동실행",
            font=("Segoe UI", 11, "bold"),
            fg="#ffffff",
            bg="#1a1a2e"
        ).pack(side="left")

        self.schedule_status = tk.Label(
            schedule_inner,
            text="확인 중...",
            font=("Segoe UI", 11),
            fg="#4ecca3",
            bg="#1a1a2e"
        )
        self.schedule_status.pack(side="right")

        # 마지막 실행 시간
        self.last_run_label = tk.Label(
            schedule_frame,
            text="",
            font=("Segoe UI", 9),
            fg="#666666",
            bg="#1a1a2e"
        )
        self.last_run_label.pack(anchor="w", padx=15, pady=(0, 10))

        # 버튼 영역
        btn_frame = tk.Frame(self.root, bg="#0f0f1a")
        btn_frame.pack(fill="x", padx=20, pady=10)

        btn_style = {
            "font": ("Segoe UI", 11, "bold"),
            "width": 20,
            "height": 2,
            "cursor": "hand2",
            "bd": 0,
            "activeforeground": "white"
        }

        # 버튼 행 1
        row1 = tk.Frame(btn_frame, bg="#0f0f1a")
        row1.pack(fill="x", pady=5)

        self.btn_run = tk.Button(
            row1,
            text="▶  지금 실행",
            bg="#4ecca3",
            fg="white",
            activebackground="#3db892",
            command=self.run_now,
            **btn_style
        )
        self.btn_run.pack(side="left", expand=True, fill="x", padx=(0, 5))

        btn_stop = tk.Button(
            row1,
            text="⏹  중지",
            bg="#e94560",
            fg="white",
            activebackground="#d13652",
            command=self.stop_execution,
            **btn_style
        )
        btn_stop.pack(side="right", expand=True, fill="x", padx=(5, 0))

        # 버튼 행 2
        row2 = tk.Frame(btn_frame, bg="#0f0f1a")
        row2.pack(fill="x", pady=5)

        btn_enable = tk.Button(
            row2,
            text="⏰  자동실행 켜기",
            bg="#0f4c75",
            fg="white",
            activebackground="#0d3d5f",
            command=self.enable_schedule,
            **btn_style
        )
        btn_enable.pack(side="left", expand=True, fill="x", padx=(0, 5))

        btn_disable = tk.Button(
            row2,
            text="⏸  자동실행 끄기",
            bg="#3d3d3d",
            fg="white",
            activebackground="#2d2d2d",
            command=self.disable_schedule,
            **btn_style
        )
        btn_disable.pack(side="right", expand=True, fill="x", padx=(5, 0))

        # 로그 영역
        log_frame = tk.Frame(self.root, bg="#0f0f1a")
        log_frame.pack(fill="both", expand=True, padx=20, pady=10)

        log_header = tk.Frame(log_frame, bg="#0f0f1a")
        log_header.pack(fill="x", pady=(0, 5))

        tk.Label(
            log_header,
            text="📋 실행 로그",
            font=("Segoe UI", 10, "bold"),
            fg="#ffffff",
            bg="#0f0f1a"
        ).pack(side="left")

        btn_clear = tk.Button(
            log_header,
            text="지우기",
            font=("Segoe UI", 9),
            bg="#2a2a4e",
            fg="#888888",
            bd=0,
            cursor="hand2",
            command=self.clear_log
        )
        btn_clear.pack(side="right")

        self.log_text = scrolledtext.ScrolledText(
            log_frame,
            font=("Consolas", 9),
            bg="#1a1a2e",
            fg="#cccccc",
            insertbackground="#cccccc",
            selectbackground="#3d3d5c",
            wrap=tk.WORD,
            height=15,
            state="disabled",
            bd=0,
            highlightthickness=1,
            highlightbackground="#2a2a4e"
        )
        self.log_text.pack(fill="both", expand=True)

        # 태그 설정
        self.log_text.tag_config("time", foreground="#666666")
        self.log_text.tag_config("info", foreground="#4ecca3")
        self.log_text.tag_config("warn", foreground="#f9a825")
        self.log_text.tag_config("error", foreground="#e94560")
        self.log_text.tag_config("success", foreground="#4ecca3")

        # 프로그레스 바
        self.progress = ttk.Progressbar(
            self.root,
            mode="indeterminate",
            length=460
        )

        # 하단 정보
        footer = tk.Label(
            self.root,
            text="v1.0 | 앱 아이디어 리포터",
            font=("Segoe UI", 9),
            fg="#444444",
            bg="#0f0f1a"
        )
        footer.pack(pady=(5, 15))

        # 시작 로그
        self.log("프로그램 시작", "info")

    def log(self, message, level="info"):
        """로그 큐에 메시지 추가"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.log_queue.put((timestamp, message, level))

    def process_log_queue(self):
        """로그 큐 처리"""
        try:
            while True:
                timestamp, message, level = self.log_queue.get_nowait()
                self.log_text.config(state="normal")
                self.log_text.insert(tk.END, f"[{timestamp}] ", "time")
                self.log_text.insert(tk.END, f"{message}\n", level)
                self.log_text.see(tk.END)
                self.log_text.config(state="disabled")
        except queue.Empty:
            pass
        self.root.after(100, self.process_log_queue)

    def clear_log(self):
        """로그 지우기"""
        self.log_text.config(state="normal")
        self.log_text.delete(1.0, tk.END)
        self.log_text.config(state="disabled")
        self.log("로그 초기화", "info")

    def update_status(self):
        """스케줄러 상태 확인"""
        try:
            result = subprocess.run(
                ['schtasks', '/query', '/tn', 'DailyAppReport', '/fo', 'list'],
                capture_output=True,
                text=True,
                creationflags=subprocess.CREATE_NO_WINDOW
            )
            output = result.stdout

            if "사용" in output and "사용 안 함" not in output:
                self.schedule_status.config(text="켜짐 (매일 09:00)", fg="#4ecca3")
            elif "Ready" in output or "Enabled" in output:
                self.schedule_status.config(text="켜짐 (매일 09:00)", fg="#4ecca3")
            elif "사용 안 함" in output or "Disabled" in output:
                self.schedule_status.config(text="꺼짐", fg="#888888")
            else:
                self.schedule_status.config(text="설정 안됨", fg="#e94560")

            # 마지막 실행 시간 확인
            if "마지막 실행 시간" in output:
                for line in output.split('\n'):
                    if "마지막 실행 시간" in line:
                        time_str = line.split(':')[-1].strip()
                        self.last_run_label.config(text=f"마지막 실행: {time_str}")
                        break
            elif "Last Run Time" in output:
                for line in output.split('\n'):
                    if "Last Run Time" in line:
                        time_str = line.split(':', 1)[-1].strip()
                        self.last_run_label.config(text=f"Last run: {time_str}")
                        break
        except:
            self.schedule_status.config(text="확인 실패", fg="#e94560")

        # 5초마다 상태 갱신
        self.root.after(5000, self.update_status)

    def set_running(self, running):
        """실행 상태 설정"""
        self.is_running = running
        if running:
            self.status_dot.config(fg="#4ecca3")
            self.status_text.config(text="실행 중", fg="#4ecca3")
            self.btn_run.config(state="disabled", bg="#2a2a4e")
            self.progress.pack(pady=(0, 10))
            self.progress.start(10)
        else:
            self.status_dot.config(fg="#888888")
            self.status_text.config(text="대기 중", fg="#888888")
            self.btn_run.config(state="normal", bg="#4ecca3")
            self.progress.stop()
            self.progress.pack_forget()

    def run_now(self):
        """지금 실행"""
        if self.is_running:
            return

        def task():
            self.set_running(True)
            self.current_process = None

            steps = [
                ("npm run collect", "앱 데이터 수집"),
                ("npm run analyze", "Claude AI 분석"),
                ("npm run save", "리포트 저장"),
                ("npm run kakao:send", "카카오톡 전송")
            ]

            try:
                for i, (cmd, desc) in enumerate(steps):
                    if not self.is_running:
                        self.log("사용자에 의해 중지됨", "warn")
                        break

                    self.log(f"[{i+1}/{len(steps)}] {desc} 시작...", "info")

                    process = subprocess.Popen(
                        cmd,
                        cwd=PROJECT_DIR,
                        shell=True,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        text=True,
                        encoding='utf-8',
                        errors='replace',
                        creationflags=subprocess.CREATE_NO_WINDOW
                    )
                    self.current_process = process

                    # 실시간 출력
                    for line in iter(process.stdout.readline, ''):
                        if line.strip():
                            # 이모지와 특수문자 포함된 라인 처리
                            clean_line = line.strip()
                            if clean_line.startswith(('✅', '✓')):
                                self.log(f"  {clean_line}", "success")
                            elif clean_line.startswith(('❌', '✗')):
                                self.log(f"  {clean_line}", "error")
                            elif clean_line.startswith(('⚠', '⏳', '🔄')):
                                self.log(f"  {clean_line}", "warn")
                            else:
                                self.log(f"  {clean_line}", "info")

                    process.wait()

                    if process.returncode != 0:
                        self.log(f"[{i+1}/{len(steps)}] {desc} 실패 (코드: {process.returncode})", "error")
                        raise Exception(f"{desc} 실패")

                    self.log(f"[{i+1}/{len(steps)}] {desc} 완료", "success")

                if self.is_running:
                    self.log("━" * 40, "info")
                    self.log("모든 작업 완료! 카카오톡을 확인하세요.", "success")

            except Exception as e:
                self.log(f"오류 발생: {str(e)}", "error")
            finally:
                self.root.after(0, lambda: self.set_running(False))
                self.current_process = None

        self.current_process = None
        threading.Thread(target=task, daemon=True).start()

    def stop_execution(self):
        """실행 중지"""
        if self.is_running:
            self.is_running = False
            if hasattr(self, 'current_process') and self.current_process:
                try:
                    self.current_process.terminate()
                except:
                    pass
            self.log("중지 요청됨...", "warn")

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
                self.log("자동실행 켜짐 (매일 09:00)", "success")
            else:
                self.log("스케줄이 등록되지 않음. 관리.bat 실행 필요", "error")
        except Exception as e:
            self.log(f"오류: {str(e)}", "error")
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
                self.log("자동실행 꺼짐", "info")
            else:
                self.log("스케줄이 등록되지 않음", "warn")
        except Exception as e:
            self.log(f"오류: {str(e)}", "error")
        self.update_status()

    def run(self):
        self.root.mainloop()

if __name__ == "__main__":
    app = DailyAppManager()
    app.run()
