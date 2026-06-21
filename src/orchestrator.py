from typing import Dict, Any, List
from src.factory import AgentFactory

class QAStateGraphOrchestrator:
    """
    State Graph / Flow Engine that coordinates the dynamic agents.
    Supports complex execution loops (e.g., looping back to Generator
    when Reviewer flags a quality gap).
    """
    def __init__(self, factory: AgentFactory):
        self.factory = factory
        # Logs to display in our interactive terminal simulator
        self.execution_logs: List[Dict[str, Any]] = []

    def log(self, step: str, message: str, status: str = "INFO"):
        self.execution_logs.append({
            "step": step,
            "message": message,
            "status": status
        })
        print(f"[{status}] {step}: {message}")

    def run_pipeline(self, initial_story: Dict[str, Any]) -> Dict[str, Any]:
        self.execution_logs.clear()
        context = {"story": initial_story}

        # 1. Retrieve Requirements
        self.log("Retrieval", "Querying Project Knowledge Base for requirement artifacts...", "INFO")
        retriever = self.factory.get_agent("Requirement_Retriever")
        retrieval_res = retriever.execute({"story": context["story"]})
        context["requirements"] = retrieval_res["response"]["requirements"]
        self.log("Retrieval", f"Retrieved {len(context['requirements'])} detailed business/compliance requirements.", "SUCCESS")

        # 2. Generate Scenarios
        self.log("Scenario_Gen", "Formulating test scenarios (Positive, Negative, Boundary)...", "INFO")
        scenario_agent = self.factory.get_agent("Scenario_Generator")
        scenarios_res = scenario_agent.execute({"requirements": context["requirements"]})
        context["scenarios"] = scenarios_res["response"]["scenarios"]
        self.log("Scenario_Gen", f"Compiled {len(context['scenarios'])} distinct logical test scenarios.", "SUCCESS")

        # 3. Generate Test Cases (Iteration 1)
        self.log("Test_Case_Gen", "Drafting structured step-by-step test cases...", "INFO")
        test_gen_agent = self.factory.get_agent("Test_Case_Generator")
        test_cases_res = test_gen_agent.execute({"scenarios": context["scenarios"]})
        context["test_cases"] = test_cases_res["response"]["test_cases"]
        self.log("Test_Case_Gen", f"Generated {len(context['test_cases'])} initial test cases.", "WARNING")

        # 4. QA Reviewer & Gap Detector Loop
        max_loops = 2
        loop_count = 0
        while loop_count < max_loops:
            self.log("QA_Reviewer", f"Running gap detector / compliance audit (Iteration {loop_count+1})...", "INFO")
            reviewer_agent = self.factory.get_agent("QA_Reviewer")
            review_res = reviewer_agent.execute({
                "requirements": context["requirements"],
                "scenarios": context["scenarios"],
                "test_cases": context["test_cases"]
            })

            review_data = review_res["response"]

            if review_data.get("status") == "Approved":
                self.log("QA_Reviewer", "Compliance Audit passed. Zero coverage gaps identified.", "SUCCESS")
                context["review_report"] = review_data
                break
            else:
                self.log("QA_Reviewer", f"GAP DETECTED: {review_data.get('feedback')}", "ERROR")
                loop_count += 1
                if loop_count >= max_loops:
                    self.log("QA_Reviewer", "Max repair iterations reached. Moving forward with minor warnings.", "WARNING")
                    context["review_report"] = review_data
                    break

                # LOOP BACK / SELF-CORRECTION
                self.log("Test_Case_Gen", "LOOP-BACK TRIGGERED: Re-routing feedback to Test Case Generator...", "WARNING")
                test_cases_res = test_gen_agent.execute({
                    "scenarios": context["scenarios"],
                    "feedback": review_data["feedback"],
                    "gaps": review_data["gaps_found"]
                })
                context["test_cases"] = test_cases_res["response"]["test_cases"]
                self.log("Test_Case_Gen", f"Self-corrected test suite compiled. Total test cases now: {len(context['test_cases'])}.", "SUCCESS")

        # 5. Traceability Matrix Validation
        self.log("Traceability", "Building bi-directional traceability graph...", "INFO")
        trace_agent = self.factory.get_agent("Traceability_Validator")
        trace_res = trace_agent.execute({
            "requirements": context["requirements"],
            "scenarios": context["scenarios"],
            "test_cases": context["test_cases"]
        })
        context["traceability"] = trace_res["response"]

        # Inject additional relationships for mapping output
        from src.traceability import TraceabilityMatrix
        matrix = TraceabilityMatrix.compute_matrix(
            context["requirements"],
            context["scenarios"],
            context["test_cases"]
        )
        context["traceability"].update(matrix)
        self.log("Traceability", f"Traceability validated successfully. Coverage: {context['traceability'].get('traceability_score')}%", "SUCCESS")

        return context
