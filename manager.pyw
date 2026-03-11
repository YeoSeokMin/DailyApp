"""
DailyApp 관리 프로그램
실시간 로그 + 상태 표시 + Codex CLI 모니터링
"""

import tkinter as tk
from tkinter import ttk, scrolledtext
import subprocess
import os
import threading
import queue
import time
from datetime import datetime
import urllib.request
import json

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))

# Codex CLI 설정
CODEX_MODEL = "gpt-5"

def check_codex_available():
    """Codex CLI 설치 여부 확인"""
    try:
        result = subprocess.run(
            "codex --version",
            shell=True,
            capture_output=True,
            text=True,
            timeout=5,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
        return result.returncode == 0
    except:
        return False

def get_codex_version():
    """Codex CLI 버전 조회"""
    try:
        result = subprocess.run(
            "codex --version",
            shell=True,
            capture_output=True,
            text=True,
            timeout=5,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
        if result.returncode == 0:
            return result.stdout.strip() or result.stderr.strip()
        return None
    except:
        return None

class DailyAppManager:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("DailyApp Manager")
        self.root.geometry("500x920")
        self.root.resizable(False, False)
        self.root.configure(bg="#0f0f1a")

        self.log_queue = queue.Queue()
        self.llm_log_queue = queue.Queue()  # LLM 로그 큐
        self.is_running = False
        self.auto_run_enabled = True  # 자정 자동실행 활성화
        self.last_auto_run_date = None  # 마지막 자동실행 날짜
        self.codex_available = False  # Codex CLI 사용 가능 상태

        self.create_widgets()
        self.center_window()
        self.update_status()
        self.process_log_queue()
        self.process_llm_log_queue()  # LLM 로그 큐 처리
        self.check_midnight()  # 자정 체크 시작
        self.check_codex_status()  # Codex CLI 상태 체크 시작

    def center_window(self):
        self.root.update_idletasks()
        x = (self.root.winfo_screenwidth() - 500) // 2
        y = (self.root.winfo_screenheight() - 920) // 2
        self.root.geometry(f"500x920+{x}+{y}")

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
            text="켜짐 (매일 00:00)",
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

        # Codex CLI 상태 카드
        llm_frame = tk.Frame(self.root, bg="#1a1a2e", highlightbackground="#2a2a4e", highlightthickness=1)
        llm_frame.pack(fill="x", padx=20, pady=10)

        llm_inner = tk.Frame(llm_frame, bg="#1a1a2e")
        llm_inner.pack(fill="x", padx=15, pady=12)

        tk.Label(
            llm_inner,
            text=f"🤖 Codex CLI ({CODEX_MODEL})",
            font=("Segoe UI", 11, "bold"),
            fg="#ffffff",
            bg="#1a1a2e"
        ).pack(side="left")

        self.llm_status = tk.Label(
            llm_inner,
            text="확인 중...",
            font=("Segoe UI", 11),
            fg="#888888",
            bg="#1a1a2e"
        )
        self.llm_status.pack(side="right")

        # Codex CLI 정보 행
        llm_info_frame = tk.Frame(llm_frame, bg="#1a1a2e")
        llm_info_frame.pack(fill="x", padx=15, pady=(0, 10))

        self.llm_model_label = tk.Label(
            llm_info_frame,
            text="",
            font=("Segoe UI", 9),
            fg="#666666",
            bg="#1a1a2e"
        )
        self.llm_model_label.pack(side="left")

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

        # 버튼 행 3 - 광고 관리
        row3 = tk.Frame(btn_frame, bg="#0f0f1a")
        row3.pack(fill="x", pady=5)

        btn_reset_ads = tk.Button(
            row3,
            text="🗑  광고 슬롯 초기화",
            bg="#ff6b6b",
            fg="white",
            activebackground="#ee5a5a",
            command=self.reset_ads,
            **btn_style
        )
        btn_reset_ads.pack(expand=True, fill="x")

        # 로그 영역 (탭)
        log_container = tk.Frame(self.root, bg="#0f0f1a")
        log_container.pack(fill="both", expand=True, padx=20, pady=10)

        # 탭 스타일 설정 (Windows 호환)
        style = ttk.Style()
        style.theme_use('default')  # 기본 테마 사용 (Windows 테마 무시)
        style.configure("Dark.TNotebook", background="#0f0f1a", borderwidth=0)
        style.configure("Dark.TNotebook.Tab",
                        background="#2a2a4e",
                        foreground="#ffffff",
                        padding=[15, 8],
                        font=("Segoe UI", 10, "bold"))
        style.map("Dark.TNotebook.Tab",
                  background=[("selected", "#4ecca3")],
                  foreground=[("selected", "#000000")])

        # 노트북 (탭 컨테이너)
        self.log_notebook = ttk.Notebook(log_container, style="Dark.TNotebook")
        self.log_notebook.pack(fill="both", expand=True)

        # 탭 1: 메인 로그
        main_log_frame = tk.Frame(self.log_notebook, bg="#1a1a2e")
        self.log_notebook.add(main_log_frame, text="📋 실행 로그")

        log_header = tk.Frame(main_log_frame, bg="#1a1a2e")
        log_header.pack(fill="x", pady=5, padx=5)

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
            main_log_frame,
            font=("Consolas", 9),
            bg="#1a1a2e",
            fg="#cccccc",
            insertbackground="#cccccc",
            selectbackground="#3d3d5c",
            wrap=tk.WORD,
            height=12,
            state="disabled",
            bd=0,
            highlightthickness=1,
            highlightbackground="#2a2a4e"
        )
        self.log_text.pack(fill="both", expand=True, padx=5, pady=(0, 5))

        # 탭 2: Codex CLI 로그
        llm_log_frame = tk.Frame(self.log_notebook, bg="#1a1a2e")
        self.log_notebook.add(llm_log_frame, text="🤖 Codex CLI 로그")

        llm_log_header = tk.Frame(llm_log_frame, bg="#1a1a2e")
        llm_log_header.pack(fill="x", pady=5, padx=5)

        btn_clear_llm = tk.Button(
            llm_log_header,
            text="지우기",
            font=("Segoe UI", 9),
            bg="#2a2a4e",
            fg="#888888",
            bd=0,
            cursor="hand2",
            command=self.clear_llm_log
        )
        btn_clear_llm.pack(side="right")

        self.llm_log_text = scrolledtext.ScrolledText(
            llm_log_frame,
            font=("Consolas", 9),
            bg="#1a1a2e",
            fg="#cccccc",
            insertbackground="#cccccc",
            selectbackground="#3d3d5c",
            wrap=tk.WORD,
            height=12,
            state="disabled",
            bd=0,
            highlightthickness=1,
            highlightbackground="#2a2a4e"
        )
        self.llm_log_text.pack(fill="both", expand=True, padx=5, pady=(0, 5))

        # 태그 설정 (메인 로그)
        self.log_text.tag_config("time", foreground="#666666")
        self.log_text.tag_config("info", foreground="#4ecca3")
        self.log_text.tag_config("warn", foreground="#f9a825")
        self.log_text.tag_config("error", foreground="#e94560")
        self.log_text.tag_config("success", foreground="#4ecca3")

        # 태그 설정 (LLM 로그)
        self.llm_log_text.tag_config("time", foreground="#666666")
        self.llm_log_text.tag_config("info", foreground="#4ecca3")
        self.llm_log_text.tag_config("warn", foreground="#f9a825")
        self.llm_log_text.tag_config("error", foreground="#e94560")
        self.llm_log_text.tag_config("success", foreground="#4ecca3")

        # 프로그레스 바
        self.progress = ttk.Progressbar(
            self.root,
            mode="indeterminate",
            length=460
        )

        # 하단 정보
        footer = tk.Label(
            self.root,
            text="v2.0 | 앱 아이디어 리포터 (Codex CLI)",
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
        """자동실행 상태 표시"""
        if self.auto_run_enabled:
            self.schedule_status.config(text="켜짐 (매일 00:00)", fg="#4ecca3")
        else:
            self.schedule_status.config(text="꺼짐", fg="#888888")

        # 마지막 실행 시간 표시
        if self.last_auto_run_date:
            self.last_run_label.config(text=f"마지막 자동실행: {self.last_auto_run_date}")

        # 5초마다 상태 갱신
        self.root.after(5000, self.update_status)

    def check_midnight(self):
        """자정 체크 (매 30초마다)"""
        now = datetime.now()
        today = now.strftime("%Y-%m-%d")

        # 자정~00:05 사이이고, 오늘 아직 실행 안 했으면 실행
        if (self.auto_run_enabled and
            now.hour == 0 and now.minute < 5 and
            self.last_auto_run_date != today and
            not self.is_running):

            self.last_auto_run_date = today
            self.log("", "info")
            self.log("🕛 자정 자동실행 시작!", "success")
            self.run_now()

        # 30초마다 체크
        self.root.after(30000, self.check_midnight)

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

        # Codex CLI 사용 가능 여부 체크
        if not check_codex_available():
            self.log("❌ Codex CLI가 설치되어 있지 않습니다", "error")
            self.log("  └ npm install -g @openai/codex 로 설치하세요", "info")
            self.llm_log("❌ Codex CLI 미설치 - 파이프라인 중단", "error")
            return

        self.log("✅ Codex CLI 확인 완료, 파이프라인 진행", "success")
        self.llm_log(f"✅ Codex CLI 사용 가능 (모델: {CODEX_MODEL})", "success")
        self._run_pipeline()

    def _run_pipeline(self):
        """실제 파이프라인 실행"""
        def task():
            self.set_running(True)
            self.current_process = None

            # (cmd, desc, detail, optional) - optional=True면 실패해도 계속 진행
            steps = [
                # 1. 피드백 분석 리포트 (선택)
                ("node feedback/feedbackAnalyzer.js report > output/feedback_report.md", "피드백 분석", "피드백 패턴/트렌드 분석", True),
                # 2. 피드백 기반 프롬프트 개선 (선택)
                ("node feedback/promptImprover.js run", "프롬프트 개선", "피드백 기반 자동 개선", True),
                # 3. 앱 수집 (필수)
                ("npm run collect", "앱 데이터 수집", "iOS/Android 신규 앱 스크래핑", False),
                # 4. Claude 분석 - Dynamic Prompt + 심층 분석 (필수)
                ("npm run analyze", "Claude AI 분석", "Dynamic Prompt + 품질 체크 + 심층 분석", False),
                # 5. 트렌드 분석 (선택)
                ("node scripts/trendDetector.js", "트렌드 분석", "주간 트렌드 감지", True),
                # 6. 리포트 저장 (필수)
                ("npm run save", "리포트 저장", "JSON 파일 생성", False),
                # 7. Git 푸시 (필수)
                ("git add web/data/reports/*.json output/*.json output/*.md && git commit -m \"Daily report\" && git push origin main", "GitHub 업로드", "리포트 푸시", False),
                # 8. Vercel 배포 (필수)
                ("cd web && vercel --prod --yes", "Vercel 배포", "웹사이트 업데이트", False),
                # 9. 카카오톡 전송 (선택)
                ("npm run kakao:send", "카카오톡 전송", "요약 메시지 발송", True)
            ]

            total_steps = len(steps)
            start_time = time.time()

            try:
                self.log("━" * 45, "info")
                self.log("🚀 자동화 파이프라인 시작 (9단계)", "info")
                self.log("━" * 45, "info")

                for i, (cmd, desc, detail, optional) in enumerate(steps):
                    if not self.is_running:
                        self.log("⚠️ 사용자에 의해 중지됨", "warn")
                        break

                    step_start = time.time()
                    self.log("", "info")
                    opt_tag = " (선택)" if optional else ""
                    self.log(f"▶ [{i+1}/{total_steps}] {desc}{opt_tag}", "info")
                    self.log(f"  └ {detail}", "info")

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
                            clean_line = line.strip()
                            # 중요 정보만 표시
                            if any(key in clean_line for key in ['✅', '✓', '완료', 'success', 'Complete', '품질']):
                                self.log(f"    ✅ {clean_line}", "success")
                            elif any(key in clean_line for key in ['❌', '✗', '실패', 'error', 'Error', 'fail']):
                                self.log(f"    ❌ {clean_line}", "error")
                            elif any(key in clean_line for key in ['⚠', '경고', 'warn', 'Warning', '스킵']):
                                self.log(f"    ⚠️ {clean_line}", "warn")
                            elif any(key in clean_line for key in ['iOS:', 'Android:', '개 ', '선정', 'KB', '수집', '분석', '저장', '전송', '배포', 'Production:', 'Aliased:', '트렌드', '테마', '시도']):
                                self.log(f"    📊 {clean_line}", "info")
                            elif any(key in clean_line for key in ['⏳', '중...', 'ing...', '대기', '로드']):
                                self.log(f"    ⏳ {clean_line}", "warn")

                    process.wait()
                    step_time = time.time() - step_start

                    if process.returncode != 0:
                        if optional:
                            self.log(f"  ⚠️ 스킵됨 ({step_time:.1f}초)", "warn")
                        else:
                            self.log(f"  ❌ 실패 (코드: {process.returncode}, {step_time:.1f}초)", "error")
                            raise Exception(f"{desc} 실패")
                    else:
                        self.log(f"  ✅ 완료 ({step_time:.1f}초)", "success")

                if self.is_running:
                    total_time = time.time() - start_time
                    self.log("", "info")
                    self.log("━" * 45, "info")
                    self.log("🎉 모든 작업 완료!", "success")
                    self.log(f"  총 소요 시간: {total_time/60:.1f}분", "info")
                    self.log("  📱 카카오톡을 확인하세요", "info")
                    self.log("  🌐 웹사이트가 업데이트되었습니다", "info")
                    self.log("━" * 45, "info")

            except Exception as e:
                total_time = time.time() - start_time
                self.log("", "info")
                self.log("━" * 45, "info")
                self.log(f"❌ 오류 발생: {str(e)}", "error")
                self.log(f"  소요 시간: {total_time/60:.1f}분", "info")
                self.log("━" * 45, "info")
            finally:
                self.llm_log("파이프라인 완료", "info")
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
        self.auto_run_enabled = True
        self.log("자동실행 켜짐 (매일 00:00)", "success")
        self.log("  └ 프로그램이 실행 중이어야 동작합니다", "info")

    def disable_schedule(self):
        """자동실행 끄기"""
        self.auto_run_enabled = False
        self.log("자동실행 꺼짐", "info")

    def reset_ads(self):
        """광고 슬롯 초기화"""
        def task():
            self.log("", "info")
            self.log("🗑 광고 슬롯 초기화 시작...", "info")

            try:
                # API URL (배포된 사이트)
                url = "https://dailyapp.vercel.app/api/ad/slots"

                req = urllib.request.Request(url, method='DELETE')
                req.add_header('Content-Type', 'application/json')

                with urllib.request.urlopen(req, timeout=10) as response:
                    result = json.loads(response.read().decode('utf-8'))

                    if result.get('success'):
                        self.log("✅ 모든 광고 슬롯이 초기화되었습니다!", "success")
                    else:
                        self.log(f"❌ 초기화 실패: {result.get('message', '알 수 없는 오류')}", "error")

            except urllib.error.URLError as e:
                self.log(f"❌ 네트워크 오류: {str(e)}", "error")
            except Exception as e:
                self.log(f"❌ 오류 발생: {str(e)}", "error")

        threading.Thread(target=task, daemon=True).start()

    # ========== Codex CLI 관련 ==========

    def llm_log(self, message, level="info"):
        """LLM 로그 큐에 메시지 추가"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.llm_log_queue.put((timestamp, message, level))

    def process_llm_log_queue(self):
        """LLM 로그 큐 처리"""
        try:
            while True:
                timestamp, message, level = self.llm_log_queue.get_nowait()
                self.llm_log_text.config(state="normal")
                self.llm_log_text.insert(tk.END, f"[{timestamp}] ", "time")
                self.llm_log_text.insert(tk.END, f"{message}\n", level)
                self.llm_log_text.see(tk.END)
                self.llm_log_text.config(state="disabled")
        except queue.Empty:
            pass
        self.root.after(100, self.process_llm_log_queue)

    def clear_llm_log(self):
        """LLM 로그 지우기"""
        self.llm_log_text.config(state="normal")
        self.llm_log_text.delete(1.0, tk.END)
        self.llm_log_text.config(state="disabled")
        self.llm_log("로그 초기화", "info")

    def check_codex_status(self):
        """Codex CLI 상태 주기적 체크"""
        def check():
            available = check_codex_available()
            self.codex_available = available

            if available:
                version = get_codex_version()
                self.llm_status.config(text="사용 가능", fg="#4ecca3")
                version_text = f"✓ {version}" if version else f"✓ {CODEX_MODEL}"
                self.llm_model_label.config(text=version_text, fg="#4ecca3")
            else:
                self.llm_status.config(text="미설치", fg="#e94560")
                self.llm_model_label.config(text="codex CLI를 설치하세요", fg="#888888")

        threading.Thread(target=check, daemon=True).start()
        # 30초마다 체크 (서버가 아니라 CLI이므로 빈도 낮춤)
        self.root.after(30000, self.check_codex_status)

    def run(self):
        self.root.mainloop()

if __name__ == "__main__":
    app = DailyAppManager()
    app.run()
